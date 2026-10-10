/** Pure, BigInt-precise helpers for turning simulated gas units into ETH/USDC previews. */

export const DEFAULT_GAS_PRICE_GWEI = '10';
export const WEI_PER_GWEI = 1_000_000_000n;
export const WEI_PER_ETH = 1_000_000_000_000_000_000n;

export type DeploymentMode = 'fresh' | 'registry';

const GAS_PATTERN = /^\d+$/;

/** "12", "12.5", "0.1" -> wei. Up to 9 fractional digits (wei resolution). */
export function parseGweiToWei(value: string): bigint | null {
  const text = value.trim().replace(/,/g, '');
  const match = /^(\d+)(?:\.(\d{1,9}))?$/.exec(text);
  if (!match) return null;
  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? '').padEnd(9, '0');
  const result = whole * WEI_PER_GWEI + BigInt(fraction || '0');
  return result > 0n ? result : null;
}

/** "2487.45", "$2,487.45" -> integer cents. Up to 2 fractional digits, rounded. */
export function parseUsdToCents(value: string): bigint | null {
  const text = value.trim().replace(/[$,\s]/g, '');
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(text);
  if (!match) return null;
  const dollars = BigInt(match[1]);
  const rawFraction = match[2] ?? '';
  // Round to cents when a third decimal is provided.
  const padded = `${rawFraction}00`.slice(0, 3);
  let cents = Number(padded);
  if (rawFraction.length === 3 && cents % 10 >= 5) cents += 10 - (cents % 10);
  const rounded = BigInt(Math.floor(cents / 10));
  const result = dollars * 100n + rounded;
  return result > 0n ? result : null;
}

export function parseGasUnits(value: `${bigint}` | string): bigint | null {
  if (typeof value !== 'string' || !GAS_PATTERN.test(value)) return null;
  try {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

/** feeWei = gasUnits * gasPriceWei. Exact. */
export function feeWeiForGas(gasUnits: bigint, gasPriceWei: bigint): bigint {
  return gasUnits * gasPriceWei;
}

/** Integer cents of (feeWei/1e18 ETH * priceCents/100 USD), rounded to nearest cent. */
export function feeCentsForFeeWei(feeWei: bigint, ethPriceCents: bigint): bigint {
  // feeWei/1e18 ETH * priceCents/100 USD/EHT * 100 cents/USD = feeWei * priceCents / 1e18.
  const divisor = 1_000_000_000_000_000_000n;
  return (feeWei * ethPriceCents + divisor / 2n) / divisor;
}

export function formatEth(feeWei: bigint, fractionDigits = 6): string {
  const negative = feeWei < 0n;
  const absolute = negative ? -feeWei : feeWei;
  const whole = absolute / WEI_PER_ETH;
  const remainder = absolute % WEI_PER_ETH;
  const decimals = remainder.toString().padStart(18, '0').slice(0, fractionDigits);
  return `${negative ? '-' : ''}${whole.toLocaleString('en-US')}.${decimals}`;
}

export function formatUsdcFromCents(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const dollars = absolute / 100n;
  const remainder = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}$${dollars.toLocaleString('en-US')}.${remainder}`;
}

export type FeePreview = {
  gasUnits: bigint;
  feeWei: bigint;
  feeEth: string;
  feeUsdc: string;
};

/** Combined preview for one gas total. Returns null when either price input is invalid. */
export function previewFeeForGas(
  gasUnits: bigint | null,
  gasPriceGwei: string,
  ethPriceUsd: string,
): FeePreview | null {
  if (gasUnits === null || gasUnits <= 0n) return null;
  const gasPriceWei = parseGweiToWei(gasPriceGwei);
  const priceCents = parseUsdToCents(ethPriceUsd);
  if (gasPriceWei === null || priceCents === null) return null;
  const feeWei = feeWeiForGas(gasUnits, gasPriceWei);
  return {
    gasUnits,
    feeWei,
    feeEth: formatEth(feeWei),
    feeUsdc: formatUsdcFromCents(feeCentsForFeeWei(feeWei, priceCents)),
  };
}

/** Gas units billed under each deployment mode. Registry reuses facets: Diamond only. */
export function gasUnitsForMode(
  diamondGas: bigint | null,
  facetsTotalGas: bigint | null,
  fullTotalGas: bigint | null,
  mode: DeploymentMode,
): bigint | null {
  if (mode === 'registry') return diamondGas;
  // Prefer the engine-computed full total; fall back to diamond + facets sum.
  if (fullTotalGas !== null && fullTotalGas > 0n) return fullTotalGas;
  if (diamondGas !== null && facetsTotalGas !== null) return diamondGas + facetsTotalGas;
  return null;
}

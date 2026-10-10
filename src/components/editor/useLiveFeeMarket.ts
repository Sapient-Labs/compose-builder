import { useCallback, useEffect, useRef, useState } from 'react';
import { WEI_PER_GWEI, parseUsdToCents } from '@/lib/compose-core/feePreview';

export const ETH_PRICE_URL = 'https://api.coinbase.com/v2/prices/ETH-USD/spot';
/** Several keyless mainnet RPCs: a lone outlier must never wear the Live badge. */
export const GAS_PRICE_RPC_URLS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
];
/** Quotes disagreeing by more than this factor mean something is wrong; fall back to manual. */
export const GAS_PRICE_MAX_DISAGREEMENT = 5n;
export const FEE_MARKET_TIMEOUT_MS = 10_000;
export const FEE_MARKET_REFRESH_MS = 120_000;

export type FeeMarket = {
  ethPriceUsd: string;
  gasPriceGwei: string;
};

export type FeeMarketStatus = 'loading' | 'live' | 'error';

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function gweiStringFromWei(wei: bigint): string {
  if (wei <= 0n) throw new Error('Gas price is unavailable.');
  const whole = wei / WEI_PER_GWEI;
  const remainder = wei % WEI_PER_GWEI;
  if (remainder === 0n) return whole.toString();
  return `${whole}.${remainder.toString().padStart(9, '0').replace(/0+$/, '')}`;
}

/** Trim RPC noise (e.g. 0.080917132) to 4 display decimals; inputs stay editable. */
function roundGweiForDisplay(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Gas price is unavailable.');
  return String(Number(parsed.toFixed(4)));
}

/** Normalize spot quotes (e.g. 2488.3333) to 2 display decimals. */
function roundUsdForDisplay(value: string): string {
  const cents = parseUsdToCents(value);
  if (cents === null) throw new Error('ETH price is unavailable.');
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

async function fetchGasPriceWei(rpcUrl: string, timeoutMs: number): Promise<bigint> {
  const data = (await fetchJson(
    rpcUrl,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
    },
    timeoutMs,
  )) as { result?: unknown };
  if (typeof data?.result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(data.result)) {
    throw new Error('Gas price is unavailable.');
  }
  const wei = BigInt(data.result);
  if (wei <= 0n) throw new Error('Gas price is unavailable.');
  return wei;
}

/**
 * Median of agreeing RPC quotes. Outliers beyond GAS_PRICE_MAX_DISAGREEMENT of the
 * median are discarded (one bad RPC once priced mainnet at 0.08 Gwei during 18 Gwei
 * reality); if nothing agrees, the gas price is unavailable and the panel falls
 * back to manual entry instead of showing a wrong Live number.
 */
export function agreeOnGasPrice(quotes: bigint[]): bigint {
  const sorted = [...quotes].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  if (!sorted.length) throw new Error('Gas price is unavailable.');
  const median = sorted[Math.floor(sorted.length / 2)];
  const agreeing = sorted.filter(
    (quote) =>
      quote * GAS_PRICE_MAX_DISAGREEMENT >= median && median * GAS_PRICE_MAX_DISAGREEMENT >= quote,
  );
  // One survivor out of several quotes is an outlier dispute, not consensus.
  if (agreeing.length < Math.min(2, sorted.length))
    throw new Error('Gas sources disagree; enter the price manually.');
  return agreeing[Math.floor(agreeing.length / 2)];
}

/** Live mainnet pricing: Coinbase spot for ETH/USD, median eth_gasPrice for gas. Keyless, no wallet. */
export async function fetchFeeMarket(timeoutMs = FEE_MARKET_TIMEOUT_MS): Promise<FeeMarket> {
  const [priceResult, ...gasResults] = await Promise.allSettled([
    (async () => {
      const data = (await fetchJson(ETH_PRICE_URL, {}, timeoutMs)) as {
        data?: { amount?: unknown };
      };
      const amount = data?.data?.amount;
      if (typeof amount !== 'string') throw new Error('ETH price is unavailable.');
      return roundUsdForDisplay(amount);
    })(),
    ...GAS_PRICE_RPC_URLS.map((rpcUrl) => fetchGasPriceWei(rpcUrl, timeoutMs)),
  ]);
  const failures: string[] = [];
  if (priceResult.status === 'rejected')
    failures.push(
      priceResult.reason instanceof Error
        ? priceResult.reason.message
        : 'ETH price is unavailable.',
    );
  const gasQuotes = gasResults.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  let gasPriceGwei = '';
  try {
    gasPriceGwei = roundGweiForDisplay(gweiStringFromWei(agreeOnGasPrice(gasQuotes)));
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'Gas price is unavailable.');
  }
  if (failures.length) throw new Error(failures.join(' '));
  return {
    ethPriceUsd: (priceResult as PromiseFulfilledResult<string>).value,
    gasPriceGwei,
  };
}

export type LiveFeeMarket = FeeMarket & {
  status: FeeMarketStatus;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => void;
};

/**
 * Live market snapshot with manual fallback. Never throws; inputs stay user-editable
 * in the panel, which only autofills from `live` values until the user edits them.
 */
export function useLiveFeeMarket(enabled: boolean): LiveFeeMarket {
  const [market, setMarket] = useState<FeeMarket>({ ethPriceUsd: '', gasPriceGwei: '' });
  const [status, setStatus] = useState<FeeMarketStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setStatus((current) => (market.ethPriceUsd || market.gasPriceGwei ? current : 'loading'));
    fetchFeeMarket()
      .then((next) => {
        if (cancelled || !mounted.current) return;
        setMarket(next);
        setError(null);
        setLastUpdated(Date.now());
        setStatus('live');
      })
      .catch((cause: unknown) => {
        if (cancelled || !mounted.current) return;
        setError(cause instanceof Error ? cause.message : 'Live pricing is unavailable.');
        setStatus((current) => (current === 'live' ? current : 'error'));
      });
    const timer = window.setInterval(() => {
      fetchFeeMarket()
        .then((next) => {
          if (cancelled || !mounted.current) return;
          setMarket(next);
          setError(null);
          setLastUpdated(Date.now());
          setStatus('live');
        })
        .catch(() => {
          /* Keep the last live values; the panel shows manual fallback. */
        });
    }, FEE_MARKET_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // market values intentionally excluded: refresh on mount/nonce/enabled only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce]);

  return { ...market, status, error, lastUpdated, refresh };
}

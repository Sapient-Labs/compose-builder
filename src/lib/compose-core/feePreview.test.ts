import { describe, expect, it } from 'vitest';
import {
  feeCentsForFeeWei,
  formatEth,
  formatUsdcFromCents,
  gasUnitsForMode,
  parseGasUnits,
  parseGweiToWei,
  parseUsdToCents,
  previewFeeForGas,
} from './feePreview';

describe('fee preview math', () => {
  it('parses gwei without floating point', () => {
    expect(parseGweiToWei('10')).toBe(10_000_000_000n);
    expect(parseGweiToWei('0.0809')).toBe(80_900_000n);
    expect(parseGweiToWei('12.5')).toBe(12_500_000_000n);
    expect(parseGweiToWei('2,487.45')).toBe(2_487_450_000_000n);
    for (const bad of ['', 'abc', '-1', '1.1234567890', '1 Gwei'])
      expect(parseGweiToWei(bad)).toBeNull();
  });

  it('parses USD prices to cents', () => {
    expect(parseUsdToCents('2488.33')).toBe(248833n);
    expect(parseUsdToCents('$2,487.45')).toBe(248745n);
    expect(parseUsdToCents('0.005')).toBe(1n);
    for (const bad of ['', 'abc', '-5', '12.3456']) expect(parseUsdToCents(bad)).toBeNull();
  });

  it('rounds sub-dollar fees instead of flooring to zero', () => {
    // Screenshot regression: 1,771,682 gas x 0.0809 Gwei x $2488.33 is $0.36, not $0.00.
    const preview = previewFeeForGas(1771682n, '0.0809', '2488.33');
    expect(preview?.feeUsdc).toBe('$0.36');
    expect(preview?.feeEth).toBe('0.000143');
  });

  it('prices a full deployment in USDC', () => {
    const preview = previewFeeForGas(844242n, '10', '2000');
    expect(preview?.feeUsdc).toBe('$16.88');
    expect(preview?.feeEth).toBe('0.008442');
  });

  it('rejects invalid price inputs without throwing', () => {
    expect(previewFeeForGas(100n, '', '2000')).toBeNull();
    expect(previewFeeForGas(100n, '10', '')).toBeNull();
    expect(previewFeeForGas(null, '10', '2000')).toBeNull();
    expect(previewFeeForGas(0n, '10', '2000')).toBeNull();
  });

  it('bills registry mode as Diamond-only', () => {
    expect(gasUnitsForMode(100n, 200n, 300n, 'registry')).toBe(100n);
    expect(gasUnitsForMode(100n, 200n, 300n, 'fresh')).toBe(300n);
    expect(gasUnitsForMode(100n, 200n, null, 'fresh')).toBe(300n);
    expect(gasUnitsForMode(null, 200n, 300n, 'fresh')).toBe(300n);
    expect(gasUnitsForMode(null, 200n, null, 'registry')).toBeNull();
  });

  it('formats large ETH and USDC values with grouping', () => {
    expect(feeCentsForFeeWei(11_146_611_000_000_000_000n, 248745n)).toBe(2772664n);
    expect(formatUsdcFromCents(2772664n)).toBe('$27,726.64');
    expect(formatEth(11_146_611_000_000_000_000n)).toBe('11.146611');
  });

  it('reproduces an independent fee calculator exactly', () => {
    // External reference: 21,000 gas x 530,791 Gwei x $2,487.45 = 11.146611 ETH = $27,726.64.
    const preview = previewFeeForGas(21000n, '530791', '2487.45');
    expect(preview?.feeEth).toBe('11.146611');
    expect(preview?.feeUsdc).toBe('$27,726.64');
  });

  it.each([
    [21000n, '30', '3000', '$1.89'],
    [530791n, '10', '2487.45', '$13.20'],
    [1771682n, '0.0809', '2488.33', '$0.36'],
    [2593692n, '50', '4000', '$518.74'],
  ])(
    'matches float arithmetic within one cent: %s gas x %s Gwei x $%s',
    (gas, gwei, usd, expected) => {
      const precise = previewFeeForGas(gas, gwei as string, usd as string);
      const floatUsd = Number(gas) * Number(gwei) * 1e-9 * Number(usd);
      expect(precise?.feeUsdc).toBe(expected);
      // BigInt path must stay within a cent of the naive float path.
      const preciseCents = Number((precise?.feeUsdc ?? '$0').replace(/[$,]/g, '')) * 100;
      expect(Math.abs(preciseCents - floatUsd * 100)).toBeLessThan(1.5);
    },
  );

  it('parses gas units strictly', () => {
    expect(parseGasUnits('530791')).toBe(530791n);
    for (const bad of ['', '1.5', '-1', '0x10', '123 gas']) expect(parseGasUnits(bad)).toBeNull();
  });
});

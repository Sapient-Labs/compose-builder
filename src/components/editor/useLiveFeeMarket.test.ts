import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { fetchFeeMarket, useLiveFeeMarket } from './useLiveFeeMarket';

const priceOk = (amount: string) =>
  ({ ok: true, json: async () => ({ data: { amount } }) }) as unknown as Response;
const gasOk = (wei: bigint) =>
  ({ ok: true, json: async () => ({ result: `0x${wei.toString(16)}` }) }) as unknown as Response;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchFeeMarket', () => {
  it('rounds RPC noise to display precision', async () => {
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).includes('coinbase') ? priceOk('2489.525') : gasOk(82_525_050n),
    );
    const market = await fetchFeeMarket();
    expect(market).toEqual({ ethPriceUsd: '2489.53', gasPriceGwei: '0.0825' });
  });

  it('fails closed with a usable message when either source breaks', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes('coinbase')) throw new Error('offline');
      return gasOk(10_000_000_000n);
    });
    await expect(fetchFeeMarket()).rejects.toThrow('offline');
  });

  it('discards a lone outlier RPC instead of wearing the Live badge', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const target = String(url);
      if (target.includes('coinbase')) return priceOk('2488.23');
      if (target.includes('llamarpc')) return gasOk(86_400_000n);
      return gasOk(10_000_000_000n);
    });
    const market = await fetchFeeMarket();
    expect(market.gasPriceGwei).toBe('10');
  });

  it('falls back to manual when no two sources agree', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const target = String(url);
      if (target.includes('coinbase')) return priceOk('2488.23');
      if (target.includes('publicnode')) return gasOk(10_000_000_000n);
      if (target.includes('llamarpc')) return gasOk(10_000_000n);
      return gasOk(100_000_000_000_000n);
    });
    await expect(fetchFeeMarket()).rejects.toThrow('disagree');
  });

  it('rejects malformed payloads', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as unknown as Response);
    await expect(fetchFeeMarket()).rejects.toThrow();
  });
});

describe('useLiveFeeMarket', () => {
  it('does not fetch until enabled', () => {
    const { result } = renderHook(({ enabled }) => useLiveFeeMarket(enabled), {
      initialProps: { enabled: false },
    });
    expect(result.current.status).toBe('loading');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('publishes live values and refreshes on demand', async () => {
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).includes('coinbase') ? priceOk('2000') : gasOk(10_000_000_000n),
    );
    const { result } = renderHook(() => useLiveFeeMarket(true));
    await waitFor(() => expect(result.current.status).toBe('live'));
    expect(result.current).toMatchObject({ ethPriceUsd: '2000.00', gasPriceGwei: '10' });
    const calls = vi.mocked(fetch).mock.calls.length;
    result.current.refresh();
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(calls));
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { simulateDiamondDeployment } from './deploymentSimulation';
import type {
  DeploymentSimulationInput,
  DeploymentSimulationResponse,
  DeploymentSimulationResult,
} from './deploymentSimulation';

const input: DeploymentSimulationInput = {
  diamond: {
    name: 'Diamond',
    path: 'contracts/Diamond.sol',
    bytecode: '6000',
    constructorInputs: [{ type: 'address[]' }],
  },
  facets: [
    { name: 'DiamondInspectFacet', path: 'inspect.sol', bytecode: '6000', constructorInputs: [] },
  ],
  compilerVersion: '0.8.30',
  settingsFingerprint: `0x${'01'.repeat(32)}`,
};
const result: DeploymentSimulationResult = {
  totalGasSpent: '9007199254740993',
  intrinsicGas: '53000',
  executionGasUsed: '9007199254687993',
  gasRefund: '0',
  facetDeployments: [{ name: 'DiamondInspectFacet', totalGasSpent: '573962' }],
  facetsTotalGasSpent: '573962',
  fullTotalGasSpent: '9007199255314955',
  facetCount: 1,
  fork: 'paris',
  compilerVersion: input.compilerVersion,
  settingsFingerprint: input.settingsFingerprint,
};
class TestWorker {
  static instances: TestWorker[] = [];
  static onCreate: (() => void) | undefined;
  onmessage: ((event: MessageEvent<DeploymentSimulationResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  url: URL;
  options: WorkerOptions;
  constructor(url: URL, options: WorkerOptions) {
    this.url = url;
    this.options = options;
    TestWorker.instances.push(this);
    TestWorker.onCreate?.();
  }
  reply(response: DeploymentSimulationResponse) {
    this.onmessage?.({ data: response } as MessageEvent<DeploymentSimulationResponse>);
  }
}
beforeEach(() => {
  TestWorker.instances = [];
  TestWorker.onCreate = undefined;
  vi.stubGlobal('Worker', TestWorker);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const currentWorker = () => TestWorker.instances.at(-1)!;

describe('disposable local gas worker client', () => {
  it('lazily starts a module worker and preserves exact decimal precision', async () => {
    expect(TestWorker.instances).toHaveLength(0);
    const promise = simulateDiamondDeployment(input);
    const worker = currentWorker();
    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.url.pathname).toContain('deploymentSimulation.worker.ts');
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'simulate', input });
    worker.reply({ type: 'simulated', result });
    expect(await promise).toEqual(result);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
  });

  it('does not start for an already aborted job', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      simulateDiamondDeployment(input, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(TestWorker.instances).toHaveLength(0);
  });

  it('terminates an abort during worker creation before posting any data', async () => {
    const controller = new AbortController();
    TestWorker.onCreate = () => controller.abort();
    await expect(
      simulateDiamondDeployment(input, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(currentWorker().terminate).toHaveBeenCalledOnce();
    expect(currentWorker().postMessage).not.toHaveBeenCalled();
  });

  it('disposes on cancellation and ignores a late result', async () => {
    const controller = new AbortController();
    const promise = simulateDiamondDeployment(input, { signal: controller.signal });
    const worker = currentWorker();
    const staleHandler = worker.onmessage!;
    controller.abort();
    staleHandler({
      data: { type: 'simulated', result },
    } as MessageEvent<DeploymentSimulationResponse>);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('times out and disposes even if a worker never responds', async () => {
    vi.useFakeTimers();
    const promise = simulateDiamondDeployment(input);
    const rejected = expect(promise).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(30_000);
    await rejected;
    expect(currentWorker().terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, -1, 30_001, Number.NaN, Number.POSITIVE_INFINITY])(
    'cannot extend or bypass the 30 second cap: %s',
    async (timeoutMs) => {
      await expect(simulateDiamondDeployment(input, { timeoutMs })).rejects.toThrow('timeout must');
      expect(TestWorker.instances).toHaveLength(0);
    },
  );

  it.each(['error', 'messageerror', 'revert'] as const)('disposes on %s', async (failure) => {
    const promise = simulateDiamondDeployment(input);
    const worker = currentWorker();
    if (failure === 'error') worker.onerror?.();
    else if (failure === 'messageerror') worker.onmessageerror?.();
    else worker.reply({ type: 'error', message: 'Diamond reverted.' });
    await expect(promise).rejects.toThrow();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('disposes when structured cloning the payload fails', async () => {
    TestWorker.onCreate = () =>
      currentWorker().postMessage.mockImplementation(() => {
        throw new Error('clone failed');
      });
    await expect(simulateDiamondDeployment(input)).rejects.toThrow('could not be sent');
    expect(currentWorker().terminate).toHaveBeenCalledOnce();
  });

  it.each([
    { totalGasSpent: 'infinite' },
    { totalGasSpent: '1' },
    { facetCount: 0 },
    { fork: 'prague' },
    { compilerVersion: 'other' },
    { settingsFingerprint: 'stale' },
    { intrinsicGas: '-1' },
    { facetsTotalGasSpent: '0' },
    { fullTotalGasSpent: '9007199254740993' },
    { facetDeployments: [] },
    { facetDeployments: [{ name: 'WrongFacet', totalGasSpent: '573962' }] },
    { facetDeployments: [{ name: 'DiamondInspectFacet', totalGasSpent: '0' }] },
  ])('rejects partial, inconsistent or wrong-job results: %s', async (change) => {
    const promise = simulateDiamondDeployment(input);
    currentWorker().reply({
      type: 'simulated',
      result: { ...result, ...change } as DeploymentSimulationResult,
    });
    await expect(promise).rejects.toThrow('invalid result');
    expect(currentWorker().terminate).toHaveBeenCalledOnce();
  });

  it('keeps newer jobs isolated from disposed older jobs', async () => {
    const controller = new AbortController();
    const oldPromise = simulateDiamondDeployment(input, { signal: controller.signal });
    const oldWorker = currentWorker();
    const oldHandler = oldWorker.onmessage!;
    controller.abort();
    await expect(oldPromise).rejects.toMatchObject({ name: 'AbortError' });
    const updatedInput = { ...input, settingsFingerprint: `0x${'02'.repeat(32)}` };
    const updatedResult = { ...result, settingsFingerprint: updatedInput.settingsFingerprint };
    const newPromise = simulateDiamondDeployment(updatedInput);
    oldHandler({
      data: { type: 'simulated', result },
    } as MessageEvent<DeploymentSimulationResponse>);
    currentWorker().reply({ type: 'simulated', result: updatedResult });
    expect(await newPromise).toEqual(updatedResult);
    expect(oldWorker.terminate).toHaveBeenCalledOnce();
    expect(currentWorker().terminate).toHaveBeenCalledOnce();
  });
});

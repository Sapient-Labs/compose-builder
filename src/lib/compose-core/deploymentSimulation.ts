import type { AbiParameter } from "viem";

/** All simulation is local, against this fixed fork and a fresh ephemeral state. */
export const DEPLOYMENT_SIMULATION_FORK = "paris" as const;
export const DEPLOYMENT_SIMULATION_TIMEOUT_MS = 30_000;

export type DeploymentArtifact = {
  name: string;
  path: string;
  /** Exact solc creation bytecode, with or without its optional 0x prefix. */
  bytecode: string;
  constructorInputs: readonly AbiParameter[];
};

export type DeploymentSimulationInput = {
  diamond: DeploymentArtifact;
  facets: DeploymentArtifact[];
  compilerVersion: string;
  /** Compiler-provided identity of the source closure, settings and ordered facets. */
  settingsFingerprint: string;
};

export type DeploymentSimulationResult = {
  /** Diamond transaction only. Setup transactions deploying facets are excluded. */
  totalGasSpent: `${bigint}`;
  intrinsicGas: `${bigint}`;
  executionGasUsed: `${bigint}`;
  /** The refund actually applied to the transaction, after its fork-specific cap. */
  gasRefund: `${bigint}`;
  facetCount: number;
  fork: typeof DEPLOYMENT_SIMULATION_FORK;
  compilerVersion: string;
  settingsFingerprint: string;
};

export type DeploymentSimulationRequest = {
  type: "simulate";
  input: DeploymentSimulationInput;
};
export type DeploymentSimulationResponse =
  | { type: "simulated"; result: DeploymentSimulationResult }
  | { type: "error"; message: string };

function validResult(value: unknown, input: DeploymentSimulationInput): value is DeploymentSimulationResult {
  if (!value || typeof value !== "object") return false;
  const result = value as DeploymentSimulationResult;
  const gasValues = [result.totalGasSpent, result.intrinsicGas, result.executionGasUsed, result.gasRefund];
  if (!gasValues.every((item) => typeof item === "string" && /^\d+$/.test(item))) return false;
  return result.fork === DEPLOYMENT_SIMULATION_FORK
    && result.facetCount === input.facets.length
    && result.compilerVersion === input.compilerVersion
    && result.settingsFingerprint === input.settingsFingerprint
    && BigInt(result.totalGasSpent) > 0n
    && BigInt(result.totalGasSpent) === BigInt(result.intrinsicGas) + BigInt(result.executionGasUsed) - BigInt(result.gasRefund);
}

/**
 * Spawn on demand, and always dispose after exactly one result, failure or abort.
 * The VM dependency graph lives in the module worker, never the main UI bundle.
 * There is no RPC, wallet provider, account connection or network fallback.
 */
export async function simulateDiamondDeployment(
  input: DeploymentSimulationInput,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<DeploymentSimulationResult> {
  const { signal } = options;
  if (signal?.aborted) throw new DOMException("Gas simulation cancelled.", "AbortError");
  const timeoutMs = options.timeoutMs ?? DEPLOYMENT_SIMULATION_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > DEPLOYMENT_SIMULATION_TIMEOUT_MS) {
    throw new Error("Gas simulation timeout must be between 1 and 30,000 milliseconds.");
  }
  const worker = new Worker(new URL("./deploymentSimulation.worker.ts", import.meta.url), { type: "module" });
  return await new Promise<DeploymentSimulationResult>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, result?: DeploymentSimulationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = () => finish(new DOMException("Gas simulation cancelled.", "AbortError"));
    const timer = setTimeout(() => finish(new Error("Local gas simulation timed out.")), timeoutMs);
    worker.onmessage = (event: MessageEvent<DeploymentSimulationResponse>) => {
      const message = event.data;
      if (message?.type === "simulated" && validResult(message.result, input)) {
        finish(undefined, message.result);
      } else if (message?.type === "error" && typeof message.message === "string") {
        finish(new Error(message.message));
      } else {
        finish(new Error("Local gas simulation returned an invalid result."));
      }
    };
    worker.onerror = () => finish(new Error("The local gas simulation worker could not run."));
    worker.onmessageerror = () => finish(new Error("The local gas simulation result could not be read."));
    signal?.addEventListener("abort", abort, { once: true });
    // Covers an abort occurring while the worker was being constructed.
    if (signal?.aborted) {
      abort();
      return;
    }
    try {
      worker.postMessage({ type: "simulate", input } satisfies DeploymentSimulationRequest);
    } catch {
      finish(new Error("The local gas simulation input could not be sent."));
    }
  });
}

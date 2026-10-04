import type { DeploymentSimulationRequest, DeploymentSimulationResponse } from "./deploymentSimulation";
import { simulateDeployment } from "./deploymentSimulationEngine";

// A worker performs one job only. Its owner terminates it on every terminal path.
let started = false;
self.onmessage = async (event: MessageEvent<DeploymentSimulationRequest>) => {
  if (started) return;
  started = true;
  try {
    if (event.data?.type !== "simulate") throw new Error("Unsupported local gas simulation request.");
    const result = await simulateDeployment(event.data.input);
    self.postMessage({ type: "simulated", result } satisfies DeploymentSimulationResponse);
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Local gas simulation failed.",
    } satisfies DeploymentSimulationResponse);
  }
};

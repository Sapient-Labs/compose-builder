import { useEffect, useState } from "react"
import { simulateDiamondDeployment } from "@/lib/compose-core/deploymentSimulation"
import type { DeploymentSimulationInput, DeploymentSimulationResult } from "@/lib/compose-core/deploymentSimulation"

export type DeploymentEstimateState =
  | { status: "idle" | "loading" }
  | { status: "ready"; result: DeploymentSimulationResult }
  | { status: "error"; error: string }

/** Start the heavy worker only in Project review. An obsolete job can never become current. */
export function useDeploymentEstimate(
  input: DeploymentSimulationInput | undefined,
  enabled: boolean,
  compileIdentity: string,
): DeploymentEstimateState {
  const key = input ? JSON.stringify([compileIdentity, input.compilerVersion, input.settingsFingerprint]) : ""
  const [settled, setSettled] = useState<{ key: string; state: DeploymentEstimateState }>()

  useEffect(() => {
    if (!enabled || !input || !key || settled?.key === key) return
    const controller = new AbortController()
    let cancelled = false
    simulateDiamondDeployment(input, { signal: controller.signal })
      .then((result) => {
        if (cancelled) return
        if (result.settingsFingerprint !== input.settingsFingerprint || result.compilerVersion !== input.compilerVersion || result.facetCount !== input.facets.length) throw new Error("Simulation result does not match the current compiled project.")
        setSettled({ key, state: { status: "ready", result } })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setSettled({ key, state: { status: "error", error: error instanceof Error ? error.message : "Local simulation failed." } })
      })
    return () => { cancelled = true; controller.abort() }
  }, [enabled, input, key, settled?.key])

  if (!enabled || !input) return { status: "idle" }
  return settled?.key === key ? settled.state : { status: "loading" }
}

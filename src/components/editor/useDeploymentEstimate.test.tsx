import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { simulateDiamondDeployment } from "@/lib/compose-core/deploymentSimulation"
import type { DeploymentSimulationInput, DeploymentSimulationResult } from "@/lib/compose-core/deploymentSimulation"
import { useDeploymentEstimate } from "./useDeploymentEstimate"

vi.mock("@/lib/compose-core/deploymentSimulation", () => ({ simulateDiamondDeployment: vi.fn() }))
const input = (key: string): DeploymentSimulationInput => ({
  compilerVersion: "0.8.30", settingsFingerprint: key,
  diamond: { name: "Diamond", path: "contracts/Diamond.sol", bytecode: "6000", constructorInputs: [{ type: "address[]" }] },
  facets: [{ name: "DiamondInspectFacet", path: "inspect.sol", bytecode: "6000", constructorInputs: [] }],
})
const resultFor = (request: DeploymentSimulationInput): DeploymentSimulationResult => ({
  totalGasSpent: "261239", executionGasUsed: "200000", intrinsicGas: "61239", gasRefund: "0",
  facetCount: request.facets.length, fork: "paris", compilerVersion: request.compilerVersion, settingsFingerprint: request.settingsFingerprint,
})
const deferred = () => {
  let resolve!: (result: DeploymentSimulationResult) => void
  let reject!: (error: Error) => void
  const promise = new Promise<DeploymentSimulationResult>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
beforeEach(() => { vi.mocked(simulateDiamondDeployment).mockReset() })
afterEach(cleanup)

it("does not load a worker in Builder and reuses matching completed results on return", async () => {
  const a = input("a")
  vi.mocked(simulateDiamondDeployment).mockResolvedValue(resultFor(a))
  const { result, rerender } = renderHook(({ enabled }) => useDeploymentEstimate(a, enabled, "config-a"), { initialProps: { enabled: false } })
  expect(result.current.status).toBe("idle")
  expect(simulateDiamondDeployment).not.toHaveBeenCalled()
  rerender({ enabled: true })
  await waitFor(() => expect(result.current.status).toBe("ready"))
  rerender({ enabled: false })
  expect(result.current.status).toBe("idle")
  rerender({ enabled: true })
  expect(result.current.status).toBe("ready")
  expect(simulateDiamondDeployment).toHaveBeenCalledOnce()
})

it("aborts obsolete artifacts and refuses a late result after selection changes", async () => {
  const a = input("a"), b = input("b"), old = deferred(), latest = deferred()
  vi.mocked(simulateDiamondDeployment).mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
  const { result, rerender } = renderHook(({ request }) => useDeploymentEstimate(request, true, "selection"), { initialProps: { request: a } })
  const oldSignal = vi.mocked(simulateDiamondDeployment).mock.calls[0][1]!.signal!
  rerender({ request: b })
  expect(oldSignal.aborted).toBe(true)
  await act(async () => old.resolve(resultFor(a)))
  expect(result.current.status).toBe("loading")
  await act(async () => latest.resolve(resultFor(b)))
  expect(result.current).toEqual({ status: "ready", result: resultFor(b) })
})

it("invalidates a displayed estimate immediately for changed configuration or compilation", async () => {
  const a = input("a")
  vi.mocked(simulateDiamondDeployment).mockResolvedValueOnce(resultFor(a)).mockReturnValue(new Promise(() => {}))
  const { result, rerender } = renderHook(({ request, key }: { request?: DeploymentSimulationInput; key: string }) => useDeploymentEstimate(request, true, key), { initialProps: { request: a as DeploymentSimulationInput | undefined, key: "one" } })
  await waitFor(() => expect(result.current.status).toBe("ready"))
  rerender({ request: a, key: "two" })
  expect(result.current.status).toBe("loading")
  rerender({ request: undefined, key: "two" })
  expect(result.current.status).toBe("idle")
})

it("terminates work when leaving Project and ignores completion until a new request", async () => {
  const a = input("a"), old = deferred()
  vi.mocked(simulateDiamondDeployment).mockReturnValueOnce(old.promise).mockResolvedValue(resultFor(a))
  const { result, rerender } = renderHook(({ enabled }) => useDeploymentEstimate(a, enabled, "a"), { initialProps: { enabled: true } })
  const signal = vi.mocked(simulateDiamondDeployment).mock.calls[0][1]!.signal!
  rerender({ enabled: false })
  expect(signal.aborted).toBe(true)
  await act(async () => old.resolve(resultFor(a)))
  expect(result.current.status).toBe("idle")
  rerender({ enabled: true })
  await waitFor(() => expect(result.current.status).toBe("ready"))
  expect(simulateDiamondDeployment).toHaveBeenCalledTimes(2)
})

it.each(["fingerprint", "compiler", "count"])("rejects a mismatched result %s", async (kind) => {
  const a = input("a"), value = resultFor(a)
  if (kind === "fingerprint") value.settingsFingerprint = "wrong"
  if (kind === "compiler") value.compilerVersion = "wrong"
  if (kind === "count") value.facetCount = 0
  vi.mocked(simulateDiamondDeployment).mockResolvedValue(value)
  const { result } = renderHook(() => useDeploymentEstimate(a, true, "a"))
  await waitFor(() => expect(result.current.status).toBe("error"))
})

it("shows bounded simulation failures rather than a partial number", async () => {
  vi.mocked(simulateDiamondDeployment).mockRejectedValue(new Error("Simulation timed out."))
  const a = input("a")
  const { result } = renderHook(() => useDeploymentEstimate(a, true, "a"))
  await waitFor(() => expect(result.current).toEqual({ status: "error", error: "Simulation timed out." }))
})

import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { readWorkspaceScroll, useProjectFileSelection } from "./workspaceViewState"

beforeEach(() => window.sessionStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it("restores selected files per project after project changes and a fresh mount", () => {
  const hook = renderHook(({ projectId }) => useProjectFileSelection(projectId, true), { initialProps: { projectId: "first" } })
  expect(hook.result.current[0]).toBe("src/Diamond.sol")
  act(() => hook.result.current[1]("src/facets/CounterDataFacet.sol"))
  hook.rerender({ projectId: "second" })
  expect(hook.result.current[0]).toBe("src/Diamond.sol")
  act(() => hook.result.current[1]("scripts/deploy.ts"))
  hook.rerender({ projectId: "first" })
  expect(hook.result.current[0]).toBe("src/facets/CounterDataFacet.sol")
  hook.unmount()
  expect(renderHook(() => useProjectFileSelection("first", true)).result.current[0]).toBe("src/facets/CounterDataFacet.sol")
  expect(renderHook(() => useProjectFileSelection("second", true)).result.current[0]).toBe("scripts/deploy.ts")
})

it("supports functional setters and rejects paths outside the display file formats", () => {
  const { result } = renderHook(() => useProjectFileSelection("first", true))
  act(() => result.current[1]((file) => file === "src/Diamond.sol" ? "script/Deploy.s.sol" : file))
  expect(result.current[0]).toBe("script/Deploy.s.sol")
  act(() => result.current[1]("../../private.sol"))
  expect(result.current[0]).toBe("script/Deploy.s.sol")
})

it("ignores invalid or malformed stored paths and scroll positions", () => {
  window.sessionStorage.setItem("compose-launchpad:workspace:source:first:selected", JSON.stringify("src/../../private.sol"))
  expect(renderHook(() => useProjectFileSelection("first", true)).result.current[0]).toBe("src/Diamond.sol")
  window.sessionStorage.setItem("compose-launchpad:workspace:source:second:selected", "{broken")
  expect(renderHook(() => useProjectFileSelection("second", true)).result.current[0]).toBe("src/Diamond.sol")
  window.sessionStorage.setItem("compose-launchpad:workspace:source:first:scroll:src%2FDiamond.sol", JSON.stringify({ top: -4, left: "5" }))
  expect(readWorkspaceScroll("first", "src/Diamond.sol")).toEqual({ top: 0, left: 0 })
})

it("leaves Classic state local and never reads or writes storage for it", () => {
  const read = vi.spyOn(Storage.prototype, "getItem")
  const write = vi.spyOn(Storage.prototype, "setItem")
  const hook = renderHook(({ projectId }) => useProjectFileSelection(projectId, false), { initialProps: { projectId: "first" } })
  act(() => hook.result.current[1]("script/Deploy.s.sol"))
  hook.rerender({ projectId: "second" })
  expect(hook.result.current[0]).toBe("script/Deploy.s.sol")
  hook.unmount()
  expect(renderHook(() => useProjectFileSelection("first", false)).result.current[0]).toBe("src/Diamond.sol")
  expect(read).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
})

it("keeps live per-project selections when reading or writing session storage is blocked", () => {
  vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw new Error("Storage blocked") })
  const hook = renderHook(({ projectId }) => useProjectFileSelection(projectId, true), { initialProps: { projectId: "first" } })
  act(() => hook.result.current[1]("src/facets/CounterDataFacet.sol"))
  hook.rerender({ projectId: "second" })
  act(() => hook.result.current[1]("scripts/deploy.ts"))
  hook.rerender({ projectId: "first" })
  expect(hook.result.current[0]).toBe("src/facets/CounterDataFacet.sol")
})

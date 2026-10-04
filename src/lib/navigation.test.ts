import { describe, expect, it, vi } from "vitest"
import { pageFromHash, subscribeToNavigation, workspaceModeFromHash, navigateWorkspace } from "./navigation"

describe("page navigation", () => {
  it("preserves the original page by default and for unknown links", () => {
    for (const hash of ["", "#/", "#unknown", "#/workspace/extra"]) expect(pageFromHash(hash)).toBe("classic")
    expect(pageFromHash("#/workspace")).toBe("workspace")
    expect(pageFromHash("#/workspace/")).toBe("workspace")
    expect(pageFromHash("#/workspace/project")).toBe("workspace")
    expect(pageFromHash("#/workspace/project/")).toBe("workspace")
  })
  it("subscribes to browser navigation and removes the listener", () => {
    const callback = vi.fn()
    const unsubscribe = subscribeToNavigation(callback)
    window.dispatchEvent(new HashChangeEvent("hashchange"))
    expect(callback).toHaveBeenCalledOnce()
    unsubscribe()
    window.dispatchEvent(new HashChangeEvent("hashchange"))
    expect(callback).toHaveBeenCalledOnce()
  })
})


it("navigates distinct Workspace modes without duplicate history entries", () => {
  window.history.replaceState(null, "", "#/workspace")
  const initial = window.history.length
  navigateWorkspace("builder")
  expect(window.history.length).toBe(initial)
  navigateWorkspace("project")
  expect(window.location.hash).toBe("#/workspace/project")
  expect(workspaceModeFromHash(window.location.hash)).toBe("project")
  expect(workspaceModeFromHash("#/workspace")).toBe("builder")
})

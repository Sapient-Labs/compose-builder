import { describe, expect, it, vi } from "vitest"
import { pageFromHash, subscribeToNavigation } from "./navigation"

describe("page navigation", () => {
  it("preserves the original page by default and for unknown links", () => {
    for (const hash of ["", "#/", "#unknown", "#/workspace/extra"]) expect(pageFromHash(hash)).toBe("classic")
    expect(pageFromHash("#/workspace")).toBe("workspace")
    expect(pageFromHash("#/workspace/")).toBe("workspace")
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

import { readFile } from "node:fs/promises"
import path from "node:path"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { DiamondGraph } from "./DiamondGraph"
import { useLaunchpadStore } from "@/lib/state/store"
import { loadBasesCatalog } from "@/lib/compose-core"
import { DiamondSetupPanel } from "@/components/editor/DiamondSetupPanel"

HTMLElement.prototype.scrollIntoView = vi.fn()

vi.mock("./webglSupport", () => ({ canRenderWebGL2: () => false }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("keeps composition selectable when WebGL is unavailable and follows configuration", async () => {
  vi.stubGlobal("fetch", async (url: string) => ({ ok: true, json: async () => JSON.parse(await readFile(path.resolve("public", url.slice(1)), "utf8")) }))
  useLaunchpadStore.getState().reset()
  useLaunchpadStore.getState().setCatalog(await loadBasesCatalog())
  useLaunchpadStore.getState().setConfig({ baseKey: "counter" })
  render(<><DiamondSetupPanel /><DiamondGraph enableWebGLFallback /></>)
  expect(screen.getByRole("status").textContent).toContain("3D preview unavailable")
  const node = screen.getByRole("button", { name: "CounterDataFacet facet" })
  fireEvent.click(node)
  expect(node.getAttribute("aria-pressed")).toBe("true")
  fireEvent.click(screen.getByRole("button", { name: "Clear selection" }))
  expect(node.getAttribute("aria-pressed")).toBe("false")
  fireEvent.click(screen.getByRole("checkbox", { name: "CounterResetFacet" }))
  expect(screen.getByRole("button", { name: "CounterResetFacet facet" })).toBeTruthy()
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Base" }), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: "None · Blank diamond" }))
  expect(screen.queryByRole("button", { name: "CounterDataFacet facet" })).toBeNull()
  expect(screen.queryByRole("button", { name: "CounterResetFacet facet" })).toBeNull()
})

import { readFileSync, readdirSync } from "node:fs"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { DiamondSetupPanel } from "./DiamondSetupPanel"
import { useLaunchpadStore } from "@/lib/state/store"
import type { BasesCatalog } from "@/types/catalog"
import { planComposition } from "@/lib/compose-core"
import { parseWorkspace, serializeWorkspace } from "@/lib/state/workspace"

const catalog: BasesCatalog = { globals: {}, features: {} }
for (const file of readdirSync("public/bases")) {
  for (const [key, value] of Object.entries(JSON.parse(readFileSync(`public/bases/${file}`, "utf8")))) {
    if (["diamond", "libraries", "examples"].includes(key)) Object.assign(catalog.globals, { [key]: value })
    else Object.assign(catalog.features, { [key]: value })
  }
}
const current = () => useLaunchpadStore.getState().activeProject!.config
beforeEach(() => { useLaunchpadStore.getState().reset(); useLaunchpadStore.getState().setCatalog(catalog) })
afterEach(cleanup)

it("starts blank, exposes every MN base, and keeps required inspection checked", () => {
  render(<DiamondSetupPanel />)
  const base = screen.getByRole("combobox", { name: "Base" }) as HTMLSelectElement
  expect(base.value).toBe("none")
  expect([...base.options].map((x) => x.value)).toEqual(["none", ...Object.entries(catalog.features).filter(([, x]) => !x.access && x.visible !== false).map(([key]) => key)])
  const required = screen.getByRole("checkbox", { name: "DiamondInspectFacet (required)" })
  expect(required.getAttribute("aria-checked") ?? String((required as HTMLInputElement).checked)).toBe("true")
  expect((required as HTMLButtonElement).disabled).toBe(true)
})

it("updates optional facets and removes incompatible base options", () => {
  render(<DiamondSetupPanel />)
  fireEvent.change(screen.getByRole("combobox", { name: "Base" }), { target: { value: "counter" } })
  fireEvent.click(screen.getByRole("checkbox", { name: "CounterResetFacet" }))
  expect(current().selectedExtensions).toEqual(["CounterResetFacet"])
  fireEvent.click(screen.getByRole("checkbox", { name: "ERC165Facet" }))
  fireEvent.change(screen.getByRole("combobox", { name: "Base" }), { target: { value: "erc-20" } })
  expect(current().selectedExtensions).toEqual([])
  expect(current().selectedLibraries).toEqual(["ERC165Facet"])
  expect(screen.queryByRole("checkbox", { name: "CounterResetFacet" })).toBeNull()
})

it("switches ownership without conflicts and prunes removed access extensions", () => {
  render(<DiamondSetupPanel />)
  const ownership = screen.getByRole("combobox", { name: "Ownership" })
  fireEvent.change(ownership, { target: { value: "owner" } })
  fireEvent.click(screen.getByRole("checkbox", { name: "OwnerRenounceFacet" }))
  fireEvent.change(ownership, { target: { value: "owner-two-step" } })
  expect(current().selectedAccess).toEqual(["owner-two-step"])
  expect(planComposition(catalog, current()).facets.map((x) => x.name)).toContain("OwnerTwoStepDataFacet")
  fireEvent.change(ownership, { target: { value: "none" } })
  expect(current().selectedAccessExtensions).toEqual([])
})

it("uses the existing project name and review action without creating a project", () => {
  const onReview = vi.fn()
  render(<DiamondSetupPanel onReview={onReview} />)
  const id = useLaunchpadStore.getState().activeProject!.id
  const input = screen.getByRole("textbox", { name: "Diamond name" }) as HTMLInputElement
  expect(input.maxLength).toBe(100)
  fireEvent.change(input, { target: { value: "My Diamond" } })
  fireEvent.click(screen.getByRole("button", { name: "Generate project" }))
  expect(onReview).toHaveBeenCalledOnce()
  const workspace = useLaunchpadStore.getState().workspace
  expect(workspace.projects).toHaveLength(1)
  expect(workspace.projects[0].id).toBe(id)
  expect(parseWorkspace(serializeWorkspace(workspace)).projects[0].name).toBe("My Diamond")
})

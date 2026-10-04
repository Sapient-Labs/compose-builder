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
// Radix scrolls the active option; jsdom has no layout implementation.
HTMLElement.prototype.scrollIntoView = vi.fn()
const choose = (name: string, value: string) => {
  fireEvent.keyDown(screen.getByRole("combobox", { name }), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: value }))
}
const current = () => useLaunchpadStore.getState().activeProject!.config
beforeEach(() => { useLaunchpadStore.getState().reset(); useLaunchpadStore.getState().setCatalog(catalog) })
afterEach(cleanup)

it("starts blank, exposes every MN base, and keeps required inspection checked", () => {
  render(<DiamondSetupPanel />)
  const base = screen.getByRole("combobox", { name: "Base" })
  expect(base.textContent).toContain("Blank diamond")
  fireEvent.keyDown(base, { key: "ArrowDown" })
  expect(screen.getAllByRole("option")).toHaveLength(1 + Object.values(catalog.features).filter((x) => !x.access && x.visible !== false).length)
  fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" })
  const required = screen.getByRole("checkbox", { name: "DiamondInspectFacet (required)" })
  expect(required.getAttribute("aria-checked") ?? String((required as HTMLInputElement).checked)).toBe("true")
  expect((required as HTMLButtonElement).disabled).toBe(true)
})

it("updates optional facets and removes incompatible base options", () => {
  render(<DiamondSetupPanel />)
  choose("Base", catalog.features.counter.label)
  fireEvent.click(screen.getByRole("checkbox", { name: "CounterResetFacet" }))
  expect(current().selectedExtensions).toEqual(["CounterResetFacet"])
  fireEvent.click(screen.getByRole("checkbox", { name: "ERC165Facet" }))
  choose("Base", catalog.features["erc-20"].label + " · " + catalog.features["erc-20"].standard)
  expect(current().selectedExtensions).toEqual([])
  expect(current().selectedLibraries).toEqual(["ERC165Facet"])
  expect(screen.queryByRole("checkbox", { name: "CounterResetFacet" })).toBeNull()
})

it("switches ownership without conflicts and prunes removed access extensions", () => {
  render(<DiamondSetupPanel />)
  choose("Ownership", catalog.features["owner"].label)
  fireEvent.click(screen.getByRole("checkbox", { name: "OwnerRenounceFacet" }))
  choose("Ownership", catalog.features["owner-two-step"].label)
  expect(current().selectedAccess).toEqual(["owner-two-step"])
  expect(planComposition(catalog, current()).facets.map((x) => x.name)).toContain("OwnerTwoStepDataFacet")
  choose("Ownership", "None")
  expect(current().selectedAccessExtensions).toEqual([])
})

it("preserves the existing project name without exposing a name field or creating a project", () => {
  useLaunchpadStore.getState().updateProject({ name: "My Diamond" })
  const onReview = vi.fn()
  render(<DiamondSetupPanel onReview={onReview} />)
  const id = useLaunchpadStore.getState().activeProject!.id
  expect(screen.queryByRole("textbox", { name: "Diamond name" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Generate project" }))
  expect(onReview).toHaveBeenCalledOnce()
  const workspace = useLaunchpadStore.getState().workspace
  expect(workspace.projects).toHaveLength(1)
  expect(workspace.projects[0].id).toBe(id)
  expect(parseWorkspace(serializeWorkspace(workspace)).projects[0].name).toBe("My Diamond")
})

it("omits informational summaries for blank and configured diamonds without changing generation", () => {
  const onReview = vi.fn()
  render(<DiamondSetupPanel onReview={onReview} />)
  expect(screen.queryByText(/facets? in this diamond/)).toBeNull()
  choose("Base", catalog.features["erc-20"].label + " · " + catalog.features["erc-20"].standard)
  fireEvent.click(screen.getByRole("checkbox", { name: "AccessControl" }))
  const plan = planComposition(catalog, current())
  expect(plan.constructorEntries.length).toBeGreaterThan(0)
  expect(current().selectedAccess).toContain("access-control")
  expect(screen.queryByText(/Review .*initializers? and sample values/)).toBeNull()
  expect(screen.queryByText(/Role access needs admin/)).toBeNull()
  expect(screen.queryByText(/facets? in this diamond/)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Generate project" }))
  expect(onReview).toHaveBeenCalledOnce()
})

import { readFileSync, readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { BasesCatalog } from "@/types/catalog"
import { DEFAULT_CONFIG } from "@/types/config"
import { updateWorkspaceConfig } from "./workspaceConfig"
import { planComposition } from "./composition"

const catalog: BasesCatalog = { globals: {}, features: {} }
for (const file of readdirSync("public/bases")) {
  for (const [key, value] of Object.entries(JSON.parse(readFileSync(`public/bases/${file}`, "utf8")))) {
    if (["diamond", "libraries", "examples"].includes(key)) Object.assign(catalog.globals, { [key]: value })
    else Object.assign(catalog.features, { [key]: value })
  }
}

describe("Workspace configuration transitions", () => {
  it("keeps the blank default and mandatory inspection facet", () => {
    const next = updateWorkspaceConfig(catalog, DEFAULT_CONFIG, {})
    expect(next).toEqual(DEFAULT_CONFIG)
    expect(planComposition(catalog, next).requiredFacets.map((x) => x.name)).toContain("DiamondInspectFacet")
  })
  it("clears base-specific options while preserving compatible libraries and access", () => {
    const old = updateWorkspaceConfig(catalog, DEFAULT_CONFIG, { baseKey: "counter", selectedExtensions: ["CounterResetFacet"], selectedLibraries: ["ERC165Facet"], selectedAccess: ["owner"] })
    const next = updateWorkspaceConfig(catalog, old, { baseKey: "erc-20" })
    expect(next.selectedExtensions).toEqual([])
    expect(next.selectedLibraries).toEqual(["ERC165Facet"])
    expect(next.selectedAccess).toEqual(["owner"])
    expect(planComposition(catalog, next).facets.some((x) => x.name === "CounterResetFacet")).toBe(false)
  })
  it("keeps exactly one ownership model and removes its obsolete extensions", () => {
    const old = updateWorkspaceConfig(catalog, DEFAULT_CONFIG, { selectedAccess: ["owner", "access-control"], selectedAccessExtensions: ["OwnerRenounceFacet"] })
    const next = updateWorkspaceConfig(catalog, old, { selectedAccess: ["owner", "access-control", "owner-two-step"] })
    expect(next.selectedAccess).toEqual(["access-control", "owner-two-step"])
    expect(planComposition(catalog, next).requiredFacets.some((x) => x.name === "OwnerTwoStepDataFacet")).toBe(true)
    const removed = updateWorkspaceConfig(catalog, next, { selectedAccess: ["access-control"] })
    expect(removed.selectedAccessExtensions).toEqual([])
  })
  it("rejects unknown explicit options without mutating the current config", () => {
    const before = JSON.stringify(DEFAULT_CONFIG)
    for (const patch of [{ baseKey: "invalid" }, { selectedExtensions: ["invalid"] }, { selectedLibraries: ["invalid"] }, { selectedAccess: ["invalid"] }, { selectedAccessExtensions: ["invalid"] }]) {
      expect(() => updateWorkspaceConfig(catalog, DEFAULT_CONFIG, patch)).toThrow()
    }
    expect(JSON.stringify(DEFAULT_CONFIG)).toBe(before)
  })
  it("resolves every visible base with ownership and role options", () => {
    for (const [baseKey, base] of Object.entries(catalog.features).filter(([, x]) => !x.access && x.visible !== false)) {
      const next = updateWorkspaceConfig(catalog, DEFAULT_CONFIG, { baseKey, selectedExtensions: Object.keys(base.optional), selectedAccess: ["owner-two-step", "access-control"] })
      expect(planComposition(catalog, next).requiredFacets.map((x) => x.name)).toContain("DiamondInspectFacet")
    }
  })
})

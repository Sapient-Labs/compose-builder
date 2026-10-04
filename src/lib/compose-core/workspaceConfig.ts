import type { BasesCatalog } from "@/types/catalog"
import type { DiamondConfig } from "@/types/config"
import { EMPTY_BASE } from "./catalog"
import { planComposition } from "./composition"
import { getAccessBases, getAvailableLibraryFacets } from "./selection"

/** Normalize dependent choices before one atomic Workspace update. Classic UI is unchanged. */
export function updateWorkspaceConfig(catalog: BasesCatalog, current: DiamondConfig, patch: Partial<DiamondConfig>): DiamondConfig {
  const next = { ...current, ...patch }
  const base = next.baseKey === "none" ? EMPTY_BASE : catalog.features[next.baseKey]
  if (!base) throw new Error(`Unknown base: ${next.baseKey}`)
  const baseChanged = next.baseKey !== current.baseKey
  const access = getAccessBases(catalog, next.baseKey)
  const libraries = getAvailableLibraryFacets(catalog, base)
  next.selectedExtensions = [...new Set(patch.selectedExtensions ?? (baseChanged ? [] : current.selectedExtensions))]
  next.selectedLibraries = [...new Set(patch.selectedLibraries ?? current.selectedLibraries.filter((name) => name in libraries))]
  next.selectedAccess = [...new Set(patch.selectedAccess ?? current.selectedAccess.filter((key) => key in access))]
  // Mirror the catalog resolver: the latest ownership choice replaces the earlier one.
  const ownership = next.selectedAccess.filter((key) => access[key]?.accessType === "ownership").at(-1)
  next.selectedAccess = next.selectedAccess.filter((key) => access[key]?.accessType !== "ownership" || key === ownership)
  const allowedAccessExtensions = new Set(next.selectedAccess.flatMap((key) => Object.keys(access[key]?.optional ?? {})))
  next.selectedAccessExtensions = [...new Set(patch.selectedAccessExtensions ?? current.selectedAccessExtensions.filter((name) => allowedAccessExtensions.has(name)))]
  // Do not commit unknown options or conflicting facet definitions to the shared store.
  planComposition(catalog, next)
  return next
}

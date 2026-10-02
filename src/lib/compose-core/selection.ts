import type {
  BaseDefinition,
  BasesCatalog,
  CatalogSelection,
  FacetEntry,
} from "@/types/catalog";
import { EMPTY_BASE } from "./catalog";
import { uniqueStrings } from "./strings";
import { isDeepEqual } from "./objects";

export function getAccessBases(
  catalog: BasesCatalog,
  selectedBaseKey?: string
): Record<string, BaseDefinition> {
  return Object.fromEntries(
    Object.entries(catalog.features).filter(
      ([key, definition]) =>
        definition.access === true && key !== selectedBaseKey
    )
  );
}

export function getAvailableLibraryFacets(
  catalog: BasesCatalog,
  selectedBase: BaseDefinition
): Record<string, FacetEntry> {
  const requiredFacets = mergeFacetMaps(
    catalog.globals.diamond?.required ?? {},
    catalog.globals.libraries?.required ?? {},
    selectedBase.required
  );

  return Object.fromEntries(
    [
      ...Object.entries(catalog.globals.diamond?.optional ?? {}),
      ...Object.entries(catalog.globals.libraries?.optional ?? {}),
    ].filter(([facetName]) => !(facetName in requiredFacets))
  );
}

export function resolveCatalogSelection(
  catalog: BasesCatalog,
  selectedBaseKey: string,
  selectedLibraries: string[],
  selectedExtensions: string[] = [],
  selectedAccessBases: string[] = [],
  selectedAccessExtensions: string[] = []
): CatalogSelection {
  const selectedBase =
    selectedBaseKey === "none"
      ? EMPTY_BASE
      : catalog.features[selectedBaseKey];
  if (!selectedBase) {
    throw new Error(
      `Unknown base: ${selectedBaseKey}. Available: ${Object.keys(catalog.features).join(", ")}`
    );
  }

  const availableGlobalLibraryFacets = getAvailableLibraryFacets(
    catalog,
    selectedBase
  );
  const accessBases = getAccessBases(catalog, selectedBaseKey);
  const selectedGlobalLibraries: string[] = [];
  const selectedAccessBaseKeys: string[] = [];
  const normalizedSelectedAccessBases = normalizeAccessBaseSelection(
    accessBases,
    selectedAccessBases
  );

  for (const libraryName of uniqueStrings(selectedLibraries)) {
    const isGlobalLibrary = libraryName in availableGlobalLibraryFacets;
    if (isGlobalLibrary) {
      selectedGlobalLibraries.push(libraryName);
      continue;
    }

    const available = Object.keys(availableGlobalLibraryFacets);
    throw new Error(
      `Unknown library: ${libraryName}. Available: ${available.join(", ")}`
    );
  }

  for (const accessName of normalizedSelectedAccessBases) {
    if (accessName === selectedBaseKey && selectedBase.access === true) {
      throw new Error(
        `Base ${selectedBaseKey} is already selected and cannot also be selected as an access layer.`
      );
    }

    if (!accessBases[accessName]) {
      throw new Error(
        `Unknown access layer: ${accessName}. Available: ${Object.keys(accessBases).join(", ")}`
      );
    }

    selectedAccessBaseKeys.push(accessName);
  }

  validateSingleOwnershipAccessBase(accessBases, selectedAccessBaseKeys);

  const accessBaseDefinitions = selectedAccessBaseKeys.map(
    (key) => accessBases[key]
  );
  const requiredFacets = mergeFacetMaps(
    catalog.globals.diamond?.required ?? {},
    catalog.globals.libraries?.required ?? {},
    selectedBase.required,
    ...accessBaseDefinitions.map((definition) => definition.required)
  );
  const availableExtensions = mergeFacetMaps(selectedBase.optional);
  const availableAccessExtensions = mergeFacetMaps(
    ...accessBaseDefinitions.map((definition) => definition.optional)
  );
  const normalizedExtensions = uniqueStrings(selectedExtensions);
  const normalizedAccessExtensions = uniqueStrings(selectedAccessExtensions);

  for (const extensionName of normalizedExtensions) {
    if (!availableExtensions[extensionName]) {
      throw new Error(
        `Unknown extension: ${extensionName}. Available: ${Object.keys(availableExtensions).join(", ")}`
      );
    }
  }

  for (const extensionName of normalizedAccessExtensions) {
    if (!availableAccessExtensions[extensionName]) {
      throw new Error(
        `Unknown access extension: ${extensionName}. Available: ${Object.keys(availableAccessExtensions).join(", ")}`
      );
    }
  }

  return {
    selectedBaseKey,
    selectedBase,
    selectedGlobalLibraries,
    selectedAccessBaseKeys,
    selectedAccessBases: accessBaseDefinitions,
    selectedExtensions: normalizedExtensions,
    selectedAccessExtensions: normalizedAccessExtensions,
    requiredFacets,
    availableGlobalLibraryFacets,
    availableExtensions,
    availableAccessExtensions,
  };
}

/** Keep persisted or stale UI state from selecting multiple ownership models. */
function normalizeAccessBaseSelection(
  accessBases: Record<string, BaseDefinition>,
  selectedAccessBases: string[]
): string[] {
  const selected = uniqueStrings(selectedAccessBases);

  return selected.reduce<string[]>((result, key) => {
    if (accessBases[key]?.accessType !== "ownership") {
      result.push(key);
      return result;
    }

    return [
      ...result.filter((selectedKey) => accessBases[selectedKey]?.accessType !== "ownership"),
      key,
    ];
  }, []);
}

function validateSingleOwnershipAccessBase(
  accessBases: Record<string, BaseDefinition>,
  selectedAccessBaseKeys: string[]
): void {
  const ownershipKeys = selectedAccessBaseKeys.filter(
    (key) => accessBases[key]?.accessType === "ownership"
  );

  if (ownershipKeys.length > 1) {
    throw new Error(
      `Access layers cannot be selected together: ${ownershipKeys.join(", ")}. Choose one ownership model.`
    );
  }
}

function mergeFacetMaps(
  ...facetMaps: Record<string, FacetEntry>[]
): Record<string, FacetEntry> {
  const merged: Record<string, FacetEntry> = {};

  for (const facetMap of facetMaps) {
    for (const [name, entry] of Object.entries(facetMap)) {
      const existing = merged[name];
      if (existing && !isDeepEqual(existing, entry)) {
        throw new Error(
          `Facet ${name} has conflicting definitions across selected bases.`
        );
      }
      merged[name] = existing ?? entry;
    }
  }

  return merged;
}

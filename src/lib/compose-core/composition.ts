import type {
  BaseDefinition,
  BasesCatalog,
  ConstructorEntry,
  Erc165Entry,
  FacetEntry,
} from "@/types/catalog";
import type { DiamondConfig } from "@/types/config";
import { resolveCatalogSelection } from "./selection";
import { uniqueStrings } from "./strings";

export type CompositionFacet = {
  name: string;
  entry: FacetEntry;
  required: boolean;
  group: "required" | "extension" | "library" | "access-extension";
};

export type CompositionPlan = {
  base: BaseDefinition;
  availableAccessExtensions: Record<string, FacetEntry>;
  facets: CompositionFacet[];
  requiredFacets: CompositionFacet[];
  selectedExtensions: CompositionFacet[];
  selectedLibraries: CompositionFacet[];
  accessExtensions: CompositionFacet[];
  constructorEntries: ConstructorEntry[];
  initializerModules: string[];
  interfaces: Erc165Entry[];
  warnings: string[];
  sourcePaths: string[];
};

export function planComposition(
  catalog: BasesCatalog,
  config: DiamondConfig,
): CompositionPlan {
  const selection = resolveCatalogSelection(
    catalog,
    config.baseKey,
    config.selectedLibraries,
    config.selectedExtensions,
    config.selectedAccess,
    config.selectedAccessExtensions,
  );

  const requiredFacets = Object.entries(selection.requiredFacets).map(
    ([name, entry]) => ({ name, entry, required: true, group: "required" as const }),
  );
  const selectedExtensions = toFacets(
    config.selectedExtensions,
    selection.availableExtensions,
    "extension",
  );
  const selectedLibraries = toFacets(
    config.selectedLibraries,
    selection.availableGlobalLibraryFacets,
    "library",
  );
  const accessExtensions = toFacets(
    config.selectedAccessExtensions,
    selection.availableAccessExtensions,
    "access-extension",
  );

  const facets = deduplicateFacets([
    ...requiredFacets,
    ...selectedExtensions,
    ...selectedLibraries,
    ...accessExtensions,
  ]);
  const entries = facets.map(({ entry }) => entry);
  const constructorEntries = [
    ...new Map(
      entries
        .flatMap((entry) => entry.constructor ?? [])
        .map((entry) => [entry.code, entry]),
    ).values(),
  ];
  const initializerModules = [
    ...new Set(
      entries
        .filter((entry) => (entry.constructor?.length ?? 0) > 0 && entry.mod)
        .map((entry) => entry.mod!),
    ),
  ];
  const interfaces = deduplicateInterfaces([
    ...(selection.selectedBase.erc165 ? [selection.selectedBase.erc165] : []),
    ...selection.selectedAccessBases.flatMap((base) =>
      base.erc165 ? [base.erc165] : [],
    ),
    ...entries.flatMap((entry) => (entry.erc165 ? [entry.erc165] : [])),
  ]);

  const warnings: string[] = [];
  if (constructorEntries.length > 0) {
    warnings.push(
      `${constructorEntries.length} initializer ${constructorEntries.length === 1 ? "entry requires" : "entries require"} review before deployment.`,
    );
  }
  if (interfaces.length > 0 && !facets.some((facet) => facet.name === "ERC165Facet")) {
    warnings.push(
      "Interfaces are present, but ERC165Facet is not selected; interface registration will be skipped.",
    );
  }

  return {
    base: selection.selectedBase,
    availableAccessExtensions: selection.availableAccessExtensions,
    facets,
    requiredFacets,
    selectedExtensions,
    selectedLibraries,
    accessExtensions,
    constructorEntries,
    initializerModules,
    interfaces,
    warnings,
    sourcePaths: uniqueStrings([
      ...entries.map((entry) => entry.path),
      ...initializerModules,
      ...interfaces.map((entry) => entry.path),
    ]),
  };
}

function toFacets(
  names: string[],
  available: Record<string, FacetEntry>,
  group: CompositionFacet["group"],
): CompositionFacet[] {
  return names.map((name) => ({
    name,
    entry: available[name],
    required: false,
    group,
  }));
}

function deduplicateFacets(facets: CompositionFacet[]): CompositionFacet[] {
  const seen = new Set<string>();
  return facets.filter((facet) => {
    if (seen.has(facet.name)) return false;
    seen.add(facet.name);
    return true;
  });
}

function deduplicateInterfaces(entries: Erc165Entry[]): Erc165Entry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

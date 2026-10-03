export { EMPTY_BASE, sortBaseFeatures } from "./catalog";
export {
  getAccessBases,
  getAvailableLibraryFacets,
  resolveCatalogSelection,
} from "./selection";
export { loadBasesCatalog } from "./loader";
export { uniqueStrings } from "./strings";
export { buildCliCommand } from "./cli";
export { planComposition } from "./composition";
export type { CompositionFacet, CompositionPlan } from "./composition";
export { compileDiamond, PINNED_SOLC_VERSION } from "./compiler";
export type {
  CompileFacetInput,
  CompilerDiagnostic,
  DiamondCompileResult,
  DiamondValidation,
  SelectorEntry,
  StorageEntry,
} from "./compiler";

import type { BaseDefinition, BasesCatalog } from "@/types/catalog";

export const EMPTY_BASE: BaseDefinition = {
  label: "None",
  required: {},
  optional: {},
};

export function sortBaseFeatures(
  features: Record<string, BaseDefinition>
): Record<string, BaseDefinition> {
  return Object.fromEntries(
    Object.entries(features).sort(([, leftDef], [, rightDef]) => {
      const leftOrder = leftDef.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = rightDef.order ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return leftDef.label.localeCompare(rightDef.label);
    })
  );
}

export function getDiamondCompilerVersion(catalog: BasesCatalog): string {
  const compilerVersion = catalog.globals.diamond?.compilerVersion;
  if (
    typeof compilerVersion !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(compilerVersion)
  ) {
    throw new Error(
      "Diamond compilerVersion must be an exact semantic version such as 0.8.30."
    );
  }

  return compilerVersion;
}

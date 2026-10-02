import type { BaseDefinition, BaseManifest, BasesCatalog } from "@/types/catalog";
import { sortBaseFeatures } from "./catalog";

const BASES_URL = "/bases";

const BASE_FILES = [
  "accesscontrol.json",
  "counter.json",
  "diamond.json",
  "erc1155.json",
  "erc20.json",
  "erc6909.json",
  "erc721.json",
  "libraries.json",
  "owner.json",
];

async function loadManifest(filename: string): Promise<BaseManifest> {
  const response = await fetch(`${BASES_URL}/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${filename}: ${response.statusText}`);
  }
  return response.json() as Promise<BaseManifest>;
}

export async function loadBasesCatalog(): Promise<BasesCatalog> {
  const manifests = await Promise.all(BASE_FILES.map(loadManifest));

  const globals: BasesCatalog["globals"] = {};
  const features: Record<string, BaseDefinition> = {};

  for (const manifest of manifests) {
    for (const [key, definition] of Object.entries(manifest)) {
      if (key === "diamond" || key === "libraries" || key === "examples") {
        globals[key] = definition;
        continue;
      }
      features[key] = definition;
    }
  }

  return { globals, features: sortBaseFeatures(features) };
}

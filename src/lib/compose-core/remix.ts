import type { DiamondConfig } from "@/types/config";
import type { BasesCatalog, CatalogSelection } from "@/types/catalog";
import {
  planComposition,
  resolveCatalogSelection,
  uniqueStrings,
} from "@/lib/compose-core";

export type ProjectFile = {
  path: string;
  content: string;
};

function selectedFacetNames(
  selection: CatalogSelection,
  config: {
    selectedExtensions: string[];
    selectedLibraries: string[];
    selectedAccessExtensions?: string[];
  },
) {
  return uniqueStrings([
    ...Object.keys(selection.requiredFacets),
    ...config.selectedExtensions,
    ...config.selectedLibraries,
    ...(config.selectedAccessExtensions ?? []),
  ]);
}

function resolveFacetEntry(selection: CatalogSelection, name: string) {
  return (
    selection.requiredFacets[name] ||
    selection.availableExtensions[name] ||
    selection.availableGlobalLibraryFacets[name] ||
    selection.availableAccessExtensions[name]
  );
}

function templateUrl(entryPath: string) {
  return `${import.meta.env.BASE_URL}templates/${entryPath.slice("./src/templates/".length)}`;
}

async function loadFacetSources(
  selection: CatalogSelection,
  config: { selectedExtensions: string[]; selectedLibraries: string[] },
): Promise<Map<string, string>> {
  const names = selectedFacetNames(selection, config);
  const sources = new Map<string, string>();

  const manifestResponse = await fetch(
    `${import.meta.env.BASE_URL}compiler/compose-sources.json`,
  );
  if (!manifestResponse.ok) return sources;
  const manifest = (await manifestResponse.json()) as { sources: Record<string, string> };

  for (const name of names) {
    const entry = resolveFacetEntry(selection, name);
    if (!entry) continue;

    let content: string | undefined;
    if (entry.path.startsWith("./src/templates/")) {
      const response = await fetch(templateUrl(entry.path));
      if (response.ok) content = await response.text();
    } else if (manifest.sources[entry.path]) {
      content = manifest.sources[entry.path];
    }
    if (content) sources.set(name, content);
  }

  return sources;
}

function generateDiamondCode(
  plan: ReturnType<typeof planComposition>,
  catalog: BasesCatalog,
): string {
  const pragma = catalog.globals.diamond?.pragma || ">=0.8.30";
  const facets = plan.facets.map((facet) => facet.name);
  const constructorEntries = plan.constructorEntries;
  const initializerModules = plan.initializerModules;
  const interfaces = plan.interfaces;
  const imports = [
    `import "@perfect-abstractions/compose/diamond/DiamondMod.sol" as DiamondMod;`,
    ...initializerModules.map(
      (path) => `import "${path}" as ${path.split("/").pop()!.replace(".sol", "")};`,
    ),
    ...(facets.includes("ERC165Facet")
      ? [
          `import "@perfect-abstractions/compose/interfaceDetection/ERC165/ERC165Mod.sol" as ERC165Mod;`,
        ]
      : []),
    ...interfaces.map((entry) => `import "${entry.path}";`),
  ];

  return `// SPDX-License-Identifier: MIT
pragma solidity ${pragma};

/* Compose
* https://compose.diamonds
*/

${imports.join("\n")}

contract Diamond {
    constructor(address[] memory _facets) {
        DiamondMod.addFacets(_facets);
        ${constructorEntries.map((entry) => entry.code).join("\n        ")}
        ${interfaces.length && facets.includes("ERC165Facet")
          ? interfaces.map((entry) => `ERC165Mod.registerInterface(${entry.id});`).join("\n          ")
          : ""}
    }

    fallback() external payable {
        DiamondMod.diamondFallback();
    }

    receive() external payable {}
  }`;
}

function generateDeployScript(
  selection: CatalogSelection,
  config: { framework: string; toolbox?: string; selectedExtensions: string[]; selectedLibraries: string[] },
): string {
  const facets = selectedFacetNames(selection, config);

  if (config.framework === "foundry") {
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Diamond} from "../src/Diamond.sol";
${facets.map((f) => `import {${f}} from "../src/facets/${f}.sol";`).join("\n")}

contract DeployScript is Script {
    function setUp() public {}

    function run() public returns (Diamond diamond) {
        vm.startBroadcast();

        address[] memory facets = new address[](${facets.length});

        ${facets.map((f, i) => `facets[${i}] = address(new ${f}());`).join("\n        ")}

        diamond = new Diamond(facets);
        console.log("Diamond:", address(diamond));

        vm.stopBroadcast();
    }
}`;
  }

  const isViem = config.toolbox === "viem";
  if (isViem) {
    return `import { viem } from "hardhat";

async function main() {
  const facets = [];

  ${facets.map((f) => {
    return `const ${f.toLowerCase()} = await viem.deployContract("${f}");
  console.log("${f}:", ${f.toLowerCase()}.address);
  facets.push(${f.toLowerCase()}.address);`;
  }).join("\n\n  ")}

  const diamond = await viem.deployContract("Diamond", [facets]);
  console.log("Diamond:", diamond.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`;
  }

  return `import { ethers } from "hardhat";

async function main() {
  const facets = [];

  ${facets.map((f) => `const ${f.toLowerCase()} = await ethers.deployContract("${f}");
  await ${f.toLowerCase()}.waitForDeployment();
  console.log("${f}:", await ${f.toLowerCase()}.getAddress());
  facets.push(await ${f.toLowerCase()}.getAddress());`).join("\n\n  ")}

  const Diamond = await ethers.getContractFactory("Diamond");
  const diamond = await Diamond.deploy(facets);
  await diamond.waitForDeployment();
  console.log("Diamond:", await diamond.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`;
}

export async function collectProjectFiles(
  catalog: BasesCatalog,
  config: DiamondConfig,
): Promise<ProjectFile[]> {
  const plan = planComposition(catalog, config);
  const selection = resolveCatalogSelection(
    catalog,
    config.baseKey,
    config.selectedLibraries,
    config.selectedExtensions,
    config.selectedAccess,
    config.selectedAccessExtensions,
  );

  const diamondCode = generateDiamondCode(plan, catalog);
  const deployScript = generateDeployScript(selection, config);
  const facetSources = await loadFacetSources(selection, config);

  const files: ProjectFile[] = [
    { path: "src/Diamond.sol", content: diamondCode },
    {
      path: config.framework === "foundry" ? "script/Deploy.s.sol" : "scripts/deploy.ts",
      content: deployScript,
    },
  ];

  for (const [name, content] of facetSources) {
    files.push({ path: `src/facets/${name}.sol`, content });
  }

  files.push({
    path: "README.md",
    content: `# ${config.baseKey === "none" ? "Blank Diamond" : config.baseKey + " Diamond"}\n\nFramework: ${config.framework}\nFacets: ${plan.facets.map((f) => f.name).join(", ")}\n\nGenerated by [Compose](https://compose.diamonds)\n`,
  });

  return files;
}

export async function createGistViaProxy(
  files: ProjectFile[],
  config: DiamondConfig,
): Promise<{ gistId: string; gistUrl: string }> {
  const response = await fetch("/api/create-gist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, config }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? `Failed to create gist (${response.status})`);
  }

  return response.json();
}

export function buildRemixUrl(gistId: string): string {
  return `https://app.remix.live/?gist=${gistId}`;
}

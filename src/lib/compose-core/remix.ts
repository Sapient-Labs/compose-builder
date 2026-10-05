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

type ComposeManifest = {
  sources: Record<string, string>;
  composePackage?: string;
};

type LoadedFacetSource = {
  path: string;
  content: string;
};

async function loadComposeManifest(): Promise<ComposeManifest | undefined> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}compiler/compose-sources.json`,
  );
  if (!response.ok) return undefined;
  return response.json() as Promise<ComposeManifest>;
}

async function loadFacetSources(
  selection: CatalogSelection,
  config: { selectedExtensions: string[]; selectedLibraries: string[] },
  manifest: ComposeManifest | undefined,
): Promise<Map<string, LoadedFacetSource>> {
  const names = selectedFacetNames(selection, config);
  const sources = new Map<string, LoadedFacetSource>();

  for (const name of names) {
    const entry = resolveFacetEntry(selection, name);
    if (!entry) continue;

    let content: string | undefined;
    if (entry.path.startsWith("./src/templates/")) {
      const response = await fetch(templateUrl(entry.path));
      if (response.ok) content = await response.text();
    } else if (manifest?.sources[entry.path]) {
      content = manifest.sources[entry.path];
    }
    if (content) sources.set(name, { path: entry.path, content });
  }

  return sources;
}

function generateDiamondCode(
  plan: ReturnType<typeof planComposition>,
  catalog: BasesCatalog,
  options: { explicitOwner?: boolean; extraImports?: string[] } = {},
): string {
  const pragma = catalog.globals.diamond?.pragma || ">=0.8.30";
  const facets = plan.facets.map((facet) => facet.name);
  const constructorEntries = plan.constructorEntries;
  const initializerModules = plan.initializerModules;
  const interfaces = plan.interfaces;
  const imports = [
    `import "@perfect-abstractions/compose/diamond/DiamondMod.sol" as DiamondMod;`,
    ...(options.extraImports ?? []),
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

  const ownerArgument = options.explicitOwner ? ", address _owner" : "";
  const initializerCode = constructorEntries
    .map((entry) =>
      options.explicitOwner ? entry.code.replace(/\bmsg\.sender\b/g, "_owner") : entry.code,
    )
    .join("\n        ");

  return `// SPDX-License-Identifier: MIT
 pragma solidity ${pragma};

/* Compose
* https://compose.diamonds
*/

${imports.join("\n")}

contract Diamond {
    constructor(address[] memory _facets${ownerArgument}) {
         DiamondMod.addFacets(_facets);
         ${initializerCode}
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
  const manifest = await loadComposeManifest();
  const facetSources = await loadFacetSources(selection, config, manifest);

  const files: ProjectFile[] = [
    { path: "src/Diamond.sol", content: diamondCode },
    {
      path: config.framework === "foundry" ? "script/Deploy.s.sol" : "scripts/deploy.ts",
      content: deployScript,
    },
  ];

  for (const [name, source] of facetSources) {
    files.push({ path: `src/facets/${name}.sol`, content: source.content });
  }

  files.push({
    path: "README.md",
    content: `# ${config.baseKey === "none" ? "Blank Diamond" : config.baseKey + " Diamond"}\n\nFramework: ${config.framework}\nFacets: ${plan.facets.map((f) => f.name).join(", ")}\n\nGenerated by [Compose](https://compose.diamonds)\n`,
  });

  return files;
}

const COMPOSE_PACKAGE_PREFIX = "@perfect-abstractions/compose/";
const REMIX_BASE_URL = "https://app.remix.live/";

export type RemixProject = {
  source: string;
  remappings: string[];
};

function generateRemixDeployer(facetNames: string[]): string {
  const assignments = facetNames
    .map((name, index) => `        facets[${index}] = address(new ${name}());`)
    .join("\n");

  return `contract ComposeDeploy {
    event Deployment(address indexed owner, address indexed diamond, address[] facets);

    function deploy() external returns (Diamond diamond) {
        address[] memory facets = new address[](${facetNames.length});
${assignments}
        diamond = new Diamond(facets, msg.sender);
        emit Deployment(msg.sender, address(diamond), facets);
    }
}`;
}

export async function buildRemixSource(
  catalog: BasesCatalog,
  config: DiamondConfig,
): Promise<RemixProject> {
  const plan = planComposition(catalog, config);

  const manifest = await loadComposeManifest();
  const packageFacets = plan.facets.map(({ name, entry }) => {
    if (!entry.path.startsWith(COMPOSE_PACKAGE_PREFIX)) {
      throw new Error(
        `Remix export is unavailable for ${name}: this facet is a local template, not a published Compose package.`,
      );
    }
    return { name, path: entry.path };
  });
  const facetImports = packageFacets.map(
    ({ name, path }) => `import {${name}} from "${path}";`,
  );
  const diamondSource = generateDiamondCode(plan, catalog, {
    explicitOwner: true,
    extraImports: facetImports,
  });
  const source = `${diamondSource}\n\n${generateRemixDeployer(
    packageFacets.map(({ name }) => name),
  )}\n`;

  const remappings = manifest?.composePackage
    ? [`${COMPOSE_PACKAGE_PREFIX}=${manifest.composePackage}/`]
    : [];

  return { source, remappings };
}

function encodeUtf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/, "");
}

export function buildRemixUrl({ source, remappings }: RemixProject): string {
  const params = new URLSearchParams();
  params.set("code", encodeUtf8Base64(source));
  if (remappings.length > 0) {
    params.set("remaps", encodeUtf8Base64(remappings.join("\n")));
  }
  return `${REMIX_BASE_URL}?#${params.toString()}`;
}

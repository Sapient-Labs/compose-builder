import { useEffect, useState } from "react"
import { useLaunchpadStore } from "@/lib/state/store"
import { resolveCatalogSelection } from "@/lib/compose-core"
import { compileDiamond } from "@/lib/compose-core/compiler"
import type { DiamondCompileResult } from "@/lib/compose-core/compiler"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { CodeBlock } from "@/components/ui/code-block"
import { Code, Terminal, FileCode } from "lucide-react"

type ProjectFile = {
  path: string
  source: string
  kind: "generated" | "facet" | "module"
}

export function PreviewArea() {
  const { catalog, config } = useLaunchpadStore()
  const [compileResult, setCompileResult] = useState<DiamondCompileResult>()
  const [compileError, setCompileError] = useState<string>()
  const [compiledSource, setCompiledSource] = useState("")
  const [failedSource, setFailedSource] = useState("")
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([])
  const [selectedFile, setSelectedFile] = useState("contracts/Diamond.sol")

  useEffect(() => {
    if (!catalog) return
    const selection = resolveCatalogSelection(
      catalog,
      config.baseKey,
      config.selectedLibraries,
      config.selectedExtensions,
      config.selectedAccess,
      config.selectedAccessExtensions,
    )
    const source = generateDiamondCode(selection, config, catalog)
    const facets = [
      ...Object.keys(selection.requiredFacets),
      ...config.selectedExtensions,
      ...config.selectedLibraries,
    ]
    const entries = facets.flatMap((facet) => {
      const entry = selection.requiredFacets[facet] ||
        selection.availableExtensions[facet] ||
        selection.availableGlobalLibraryFacets[facet] ||
        selection.availableAccessExtensions[facet]
      return entry ? [entry] : []
    })
    const add = (files: ProjectFile[], file: ProjectFile) => {
      if (!files.some((item) => item.path === file.path)) files.push(file)
    }
    const nextFiles: ProjectFile[] = [
      { path: "contracts/Diamond.sol", source, kind: "generated" },
    ]
    fetch(`${import.meta.env.BASE_URL}compiler/compose-sources.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Compose source manifest unavailable.")
        return response.json() as Promise<{ sources: Record<string, string> }>
      })
      .then(async (manifest) => {
        for (const entry of entries) {
          const displayPath = entry.path.startsWith("./")
            ? entry.path.slice(2)
            : entry.path
          if (entry.path.startsWith("./src/templates/")) {
            const url = `${import.meta.env.BASE_URL}templates/${entry.path.slice("./src/templates/".length)}`
            const response = await fetch(url)
            if (response.ok)
              add(nextFiles, {
                path: displayPath,
                source: await response.text(),
                kind: "facet",
              })
          } else if (manifest.sources[entry.path]) {
            add(nextFiles, { path: displayPath, source: manifest.sources[entry.path], kind: "facet" })
          }
        }
        setProjectFiles(nextFiles)
        setSelectedFile((current) =>
          nextFiles.some((file) => file.path === current)
            ? current
            : "contracts/Diamond.sol",
        )
      })
      .catch(() => {
        setProjectFiles(nextFiles)
        setSelectedFile("contracts/Diamond.sol")
      })
  }, [catalog, config])

  useEffect(() => {
    if (!catalog) return
    const selection = resolveCatalogSelection(
      catalog,
      config.baseKey,
      config.selectedLibraries,
      config.selectedExtensions,
      config.selectedAccess,
      config.selectedAccessExtensions,
    )
    const source = generateDiamondCode(selection, config, catalog)
    const controller = new AbortController()
    compileDiamond(source, controller.signal)
      .then((result) => {
        setCompileResult(result)
        setCompiledSource(source)
        setCompileError(undefined)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          {
            setCompileError(error instanceof Error ? error.message : "Compilation failed.")
            setFailedSource(source)
          }
      })
    return () => controller.abort()
  }, [catalog, config])

  if (!catalog) return null

  const selection = resolveCatalogSelection(
    catalog,
    config.baseKey,
    config.selectedLibraries,
    config.selectedExtensions,
    config.selectedAccess,
    config.selectedAccessExtensions
  )

  const allFacets = [
    ...Object.keys(selection.requiredFacets),
    ...config.selectedExtensions,
    ...config.selectedLibraries,
  ]

  const diamondCode = generateDiamondCode(selection, config, catalog)
  const cliCommand = buildCliCommand(config)
  const deployScript = generateDeployScript(selection, config)
  const currentCompileResult = compiledSource === diamondCode ? compileResult : undefined
  const currentCompileError = failedSource === diamondCode ? compileError : undefined
  const compiling = !!catalog && !currentCompileResult && !currentCompileError
  const hasCompilerErrors = currentCompileResult?.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error",
  )
  const isValidated = !!currentCompileResult && !hasCompilerErrors && currentCompileResult.validation.ok
  const currentFile = projectFiles.find((file) => file.path === selectedFile) ?? {
    path: "contracts/Diamond.sol",
    source: diamondCode,
    kind: "generated" as const,
  }
  const fileLabel = (path: string) => path.split("/").pop() ?? path

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="text-sm text-muted-foreground">
            {allFacets.length} facets selected
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="animate-in fade-in">
            {config.baseKey === "none" ? "Blank" : selection.selectedBase.label}
          </Badge>
          <Badge variant="outline">
            {config.framework}
          </Badge>
          <Badge variant={isValidated ? "default" : "destructive"}>
            {compiling ? "Compiling" : isValidated ? "Validated" : "Needs review"}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="code" className="h-full flex flex-col">
          <div className="border-b px-4">
            <TabsList>
              <TabsTrigger value="code">
                <Code className="size-4 mr-2" />
                Project
              </TabsTrigger>
              <TabsTrigger value="deploy">
                <FileCode className="size-4 mr-2" />
                Deploy Script
              </TabsTrigger>
              <TabsTrigger value="cli">
                <Terminal className="size-4 mr-2" />
                CLI Command
              </TabsTrigger>
              <TabsTrigger value="validation">
                Validation
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="code" className="flex-1 overflow-auto m-0">
            <div className="h-full flex min-h-0">
              <aside className="w-64 shrink-0 border-r p-3 overflow-y-auto">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Project files · {projectFiles.length || 1}
                </div>
                <div className="space-y-1">
                  {(projectFiles.length ? projectFiles : [currentFile]).map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      title={file.path}
                      className={`w-full text-left rounded px-2 py-2 text-xs transition-colors ${file.path === currentFile.path ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                      onClick={() => setSelectedFile(file.path)}
                    >
                      <span className="block truncate">{fileLabel(file.path)}</span>
                    </button>
                  ))}
                </div>
              </aside>
              <div className="min-w-0 flex-1 p-4 h-full overflow-auto">
                <div className="text-xs text-muted-foreground mb-2" title={currentFile.path}>
                  {fileLabel(currentFile.path)}
                </div>
                <CodeBlock
                  code={currentFile.source}
                  language="solidity"
                  className="h-full"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deploy" className="flex-1 overflow-auto m-0">
            <div className="p-4 h-full">
              <CodeBlock 
                code={deployScript} 
                language={config.framework === "foundry" ? "solidity" : "typescript"}
                className="h-full"
              />
            </div>
          </TabsContent>

          <TabsContent value="cli" className="flex-1 overflow-auto m-0">
            <div className="p-4 h-full">
              <CodeBlock 
                code={cliCommand} 
                language="bash"
                className="h-full"
              />
            </div>
          </TabsContent>

          <TabsContent value="validation" className="flex-1 overflow-auto m-0">
            <div className="p-4 space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">
                  {compiling
                    ? "Compiling with pinned solc 0.8.30..."
                    : compileError
                      ? "Compiler unavailable"
                      : isValidated
                        ? "Diamond passed local validation"
                        : "Diamond needs review"}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  This is a local compiler and adapter check, not a security audit
                  or deployment approval.
                </p>
              </div>
              {currentCompileError && (
                <p className="text-sm text-destructive" role="alert">
                  {currentCompileError}
                </p>
              )}
              {currentCompileResult && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border p-3">
                      <strong>Creation bytecode</strong>
                      <p className="text-muted-foreground">
                        {currentCompileResult.validation.creationBytes ?? 0} bytes
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <strong>Runtime bytecode</strong>
                      <p className="text-muted-foreground">
                        {currentCompileResult.validation.runtimeBytes ?? 0} bytes
                      </p>
                    </div>
                  </div>
                  {currentCompileResult.validation.messages.length > 0 && (
                    <ul className="space-y-2 text-sm" role="list">
                      {currentCompileResult.validation.messages.map((message) => (
                        <li key={message} className="text-destructive">{message}</li>
                      ))}
                    </ul>
                  )}
                  {currentCompileResult.diagnostics.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Compiler diagnostics</h3>
                      {currentCompileResult.diagnostics.map((diagnostic, index) => (
                        <pre key={`${diagnostic.severity}-${index}`} className="whitespace-pre-wrap text-xs text-muted-foreground">
                          {diagnostic.message}
                        </pre>
                      ))}
                    </div>
                  )}
                  {currentCompileResult.diagnostics.length === 0 &&
                    currentCompileResult.validation.messages.length === 0 && (
                      <p className="text-sm text-green-500">
                        No compiler errors. Constructor, fallback and EVM size checks passed.
                      </p>
                    )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function buildCliCommand(
  config: { baseKey: string; framework: string; toolbox?: string; selectedLibraries: string[]; selectedExtensions: string[]; selectedAccess: string[]; selectedAccessExtensions: string[] }
): string {
  const parts = ["compose", "init", "--yes"]

  parts.push(`--base ${config.baseKey}`)
  parts.push(`--framework ${config.framework}`)

  if (config.framework === "hardhat" && config.toolbox) {
    parts.push(`--toolbox ${config.toolbox}`)
  }

  if (config.selectedLibraries.length > 0) {
    parts.push(`--libraries ${config.selectedLibraries.join(",")}`)
  }

  if (config.selectedExtensions.length > 0) {
    parts.push(`--extensions ${config.selectedExtensions.join(",")}`)
  }

  const ownership = config.selectedAccess.filter((a) =>
    ["owner", "ownable"].includes(a)
  )
  const roleAccess = config.selectedAccess.filter(
    (a) => !["owner", "ownable"].includes(a)
  )

  if (ownership.length > 0) {
    parts.push(`--ownership ${ownership[0]}`)
  }

  if (roleAccess.length > 0) {
    parts.push(`--access-control ${roleAccess.join(",")}`)
  }

  if (config.selectedAccessExtensions.length > 0) {
    parts.push(`--access-control-extensions ${config.selectedAccessExtensions.join(",")}`)
  }

  return parts.join(" \\\n  ")
}

function generateDiamondCode(
  selection: ReturnType<typeof resolveCatalogSelection>,
  config: { framework: string; selectedExtensions: string[]; selectedLibraries: string[] },
  catalog: any
): string {
  const pragma = catalog.globals.diamond?.pragma || ">=0.8.30"
  const facets = [
    ...Object.keys(selection.requiredFacets),
    ...config.selectedExtensions,
    ...config.selectedLibraries,
  ]
  const entries = facets.map((facet) =>
    selection.requiredFacets[facet] ||
    selection.availableExtensions[facet] ||
    selection.availableGlobalLibraryFacets[facet] ||
    selection.availableAccessExtensions[facet],
  ).filter(Boolean)
  const constructorEntries = [
    ...new Map(
      entries
        .flatMap((entry) => entry.constructor ?? [])
        .map((entry) => [entry.code, entry]),
    ).values(),
  ]
  const initializerModules = [
    ...new Set(
      entries
        .filter((entry) => entry.constructor?.length && entry.mod)
        .map((entry) => entry.mod!),
    ),
  ]
  const interfaces = [
    ...(selection.selectedBase.erc165 ? [selection.selectedBase.erc165] : []),
    ...selection.selectedAccessBases.flatMap((base) =>
      base.erc165 ? [base.erc165] : [],
    ),
    ...entries.flatMap((entry) => entry.erc165 ? [entry.erc165] : []),
  ].filter((entry, index, all) =>
    all.findIndex((candidate) => candidate.id === entry.id) === index,
  )
  const imports = [
    `import "@perfect-abstractions/compose/diamond/DiamondMod.sol" as DiamondMod;`,
    ...initializerModules.map((path) => `import "${path}" as ${path.split("/").pop()!.replace(".sol", "")};`),
    ...(facets.includes("ERC165Facet")
      ? [`import "@perfect-abstractions/compose/interfaceDetection/ERC165/ERC165Mod.sol" as ERC165Mod;`]
      : []),
    ...interfaces.map((entry) => `import "${entry.path}";`),
  ]

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
          ? interfaces.map((entry) => `ERC165Mod.registerInterface(${entry.id});`).join("\n        ")
          : ""}
    }

    fallback() external payable {
        DiamondMod.diamondFallback();
    }

    receive() external payable {}
}`
}

function generateDeployScript(
  selection: ReturnType<typeof resolveCatalogSelection>,
  config: { framework: string; toolbox?: string; selectedExtensions: string[]; selectedLibraries: string[] }
): string {
  const facets = [
    ...Object.keys(selection.requiredFacets),
    ...config.selectedExtensions,
    ...config.selectedLibraries,
  ]

  if (config.framework === "foundry") {
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Diamond} from "../src/Diamond.sol";
${facets.map(f => `import {${f}} from "../src/${f}.sol";`).join("\n")}

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
}`
  } else {
    const isViem = config.toolbox === "viem"
    if (isViem) {
      return `import { viem } from "hardhat";

async function main() {
  const facets = [];

  ${facets.map(f => {
    if (isViem) {
      return `const ${f.toLowerCase()} = await viem.deployContract("${f}");
  console.log("${f}:", ${f.toLowerCase()}.address);
  facets.push(${f.toLowerCase()}.address);`
    } else {
      return `const ${f.toLowerCase()} = await ethers.deployContract("${f}");
  await ${f.toLowerCase()}.waitForDeployment();
  console.log("${f}:", await ${f.toLowerCase()}.getAddress());
  facets.push(await ${f.toLowerCase()}.getAddress());`
    }
  }).join("\n\n  ")}

  const diamond = await viem.deployContract("Diamond", [facets]);
  console.log("Diamond:", diamond.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`
    }
    return `import { ethers } from "hardhat";

async function main() {
  const facets = [];

  ${facets.map(f => `const ${f.toLowerCase()} = await ethers.deployContract("${f}");
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
});`
  }
}

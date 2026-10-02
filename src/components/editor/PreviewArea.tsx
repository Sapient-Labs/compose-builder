import { useEffect, useMemo, useState } from "react"
import { useLaunchpadStore } from "@/lib/state/store"
import { resolveCatalogSelection, uniqueStrings } from "@/lib/compose-core"
import { compileDiamond } from "@/lib/compose-core/compiler"
import type {
  CompileFacetInput,
  DiamondCompileResult,
  SelectorEntry,
  StorageEntry,
} from "@/lib/compose-core/compiler"
import type { Framework, HardhatToolbox } from "@/types/config"
import type { CatalogSelection } from "@/types/catalog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { CodeBlock } from "@/components/ui/code-block"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Code,
  Terminal,
  FileCode,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Gem,
} from "lucide-react"
import { DiamondGraph } from "@/components/graph/DiamondGraph"

type ProjectFile = {
  path: string
  source: string
  kind: "generated" | "facet" | "module"
}

function selectedFacetNames(selection: CatalogSelection, config: { selectedExtensions: string[]; selectedLibraries: string[] }) {
  return uniqueStrings([
    ...Object.keys(selection.requiredFacets),
    ...config.selectedExtensions,
    ...config.selectedLibraries,
  ])
}

function resolveFacetEntry(selection: CatalogSelection, name: string) {
  return (
    selection.requiredFacets[name] ||
    selection.availableExtensions[name] ||
    selection.availableGlobalLibraryFacets[name] ||
    selection.availableAccessExtensions[name]
  )
}

function templateUrl(entryPath: string) {
  return `${import.meta.env.BASE_URL}templates/${entryPath.slice("./src/templates/".length)}`
}

function normalizeCompilePath(entryPath: string) {
  return entryPath.startsWith("./") ? entryPath.slice(2) : entryPath
}

async function loadFacetCompileInputs(
  selection: CatalogSelection,
  config: { selectedExtensions: string[]; selectedLibraries: string[] },
): Promise<CompileFacetInput[]> {
  const names = selectedFacetNames(selection, config)
  const manifestResponse = await fetch(`${import.meta.env.BASE_URL}compiler/compose-sources.json`)
  if (!manifestResponse.ok) throw new Error("Compose source manifest unavailable.")
  const manifest = (await manifestResponse.json()) as { sources: Record<string, string> }
  const inputs: CompileFacetInput[] = []

  for (const name of names) {
    const entry = resolveFacetEntry(selection, name)
    if (!entry) continue
    let content: string | undefined
    if (entry.path.startsWith("./src/templates/")) {
      const response = await fetch(templateUrl(entry.path))
      if (response.ok) content = await response.text()
    } else if (manifest.sources[entry.path]) {
      content = manifest.sources[entry.path]
    }
    if (!content) continue
    inputs.push({
      name,
      path: normalizeCompilePath(entry.path),
      content,
    })
  }

  return inputs
}

export function PreviewArea() {
  const { catalog, config, setConfig } = useLaunchpadStore()
  const [compileResult, setCompileResult] = useState<DiamondCompileResult>()
  const [compileError, setCompileError] = useState<string>()
  const [compiledSource, setCompiledSource] = useState("")
  const [failedSource, setFailedSource] = useState("")
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([])
  const [selectedFile, setSelectedFile] = useState("contracts/Diamond.sol")

  const selection = useMemo(() => {
    if (!catalog) return null
    return resolveCatalogSelection(
      catalog,
      config.baseKey,
      config.selectedLibraries,
      config.selectedExtensions,
      config.selectedAccess,
      config.selectedAccessExtensions,
    )
  }, [catalog, config])

  const diamondCode = useMemo(() => {
    if (!catalog || !selection) return ""
    return generateDiamondCode(selection, config, catalog)
  }, [catalog, selection, config])

  const facetNames = useMemo(
    () => (selection ? selectedFacetNames(selection, config) : []),
    [selection, config],
  )

  useEffect(() => {
    if (!catalog || !selection) return
    const entries = facetNames.flatMap((facet) => {
      const entry = resolveFacetEntry(selection, facet)
      return entry ? [entry] : []
    })
    const add = (files: ProjectFile[], file: ProjectFile) => {
      if (!files.some((item) => item.path === file.path)) files.push(file)
    }
    const nextFiles: ProjectFile[] = [
      { path: "contracts/Diamond.sol", source: diamondCode, kind: "generated" },
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
            const response = await fetch(templateUrl(entry.path))
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
  }, [catalog, selection, facetNames, diamondCode])

  useEffect(() => {
    if (!catalog || !selection || !diamondCode) return
    const controller = new AbortController()
    let cancelled = false

    loadFacetCompileInputs(selection, config)
      .then(async (facetInputs) => {
        if (cancelled || controller.signal.aborted) return
        const result = await compileDiamond(diamondCode, facetInputs, controller.signal)
        if (cancelled) return
        setCompileResult(result)
        setCompiledSource(diamondCode)
        setCompileError(undefined)
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return
        setCompileError(error instanceof Error ? error.message : "Compilation failed.")
        setFailedSource(diamondCode)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [catalog, selection, diamondCode, config])

  if (!catalog || !selection) return null

  const allFacets = facetNames
  const cliCommand = buildCliCommand(config)
  const deployScript = generateDeployScript(selection, config)
  const currentCompileResult = compiledSource === diamondCode ? compileResult : undefined
  const currentCompileError = failedSource === diamondCode ? compileError : undefined
  const compiling = !!catalog && !currentCompileResult && !currentCompileError
  const hasCompilerErrors = currentCompileResult?.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error",
  )
  const validationMessages = currentCompileResult?.validation.messages ?? []
  const selectors = currentCompileResult?.validation.selectors ?? []
  const storage = currentCompileResult?.validation.storage ?? []
  const collisionCount = currentCompileResult?.validation.collisionCount ?? 0
  const isValidated =
    !!currentCompileResult &&
    !hasCompilerErrors &&
    currentCompileResult.validation.ok
  const currentFile = projectFiles.find((file) => file.path === selectedFile) ?? {
    path: "contracts/Diamond.sol",
    source: diamondCode,
    kind: "generated" as const,
  }
  const fileLabel = (path: string) => path.split("/").pop() ?? path
  const validationIcon = compiling ? (
    <Loader2
      className="size-4 animate-spin text-amber-600 motion-reduce:animate-none group-data-[state=active]:text-amber-300 dark:text-amber-400 dark:group-data-[state=active]:text-amber-600"
      aria-hidden="true"
    />
  ) : currentCompileError || hasCompilerErrors || validationMessages.length > 0 ? (
    <AlertTriangle
      className="size-4 text-destructive group-data-[state=active]:text-red-300 dark:group-data-[state=active]:text-red-700"
      aria-hidden="true"
    />
  ) : isValidated ? (
    <CheckCircle2
      className="size-4 text-green-600 group-data-[state=active]:text-green-300 dark:text-green-400 dark:group-data-[state=active]:text-green-700"
      aria-hidden="true"
    />
  ) : (
    <ShieldCheck className="size-4" aria-hidden="true" />
  )

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Your application</h2>
          <p className="text-sm text-muted-foreground">
            {allFacets.length} facets selected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="animate-in fade-in">
            {config.baseKey === "none" ? "Blank" : selection.selectedBase.label}
          </Badge>
          <Select
            value={
              config.framework === "hardhat"
                ? `hardhat:${config.toolbox ?? "ethers"}`
                : "foundry"
            }
            onValueChange={(value) => {
              if (value === "foundry") {
                setConfig({ framework: "foundry" })
                return
              }
              const [framework, toolbox] = value.split(":") as [
                Framework,
                HardhatToolbox,
              ]
              setConfig({ framework, toolbox })
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-7 gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold shadow-none"
              aria-label="Framework"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="foundry">foundry</SelectItem>
              <SelectItem value="hardhat:ethers">hardhat · ethers</SelectItem>
              <SelectItem value="hardhat:viem">hardhat · viem</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="code" className="h-full flex flex-col">
          <div className="border-b bg-muted/25 px-3 py-2">
            <TabsList className="w-full">
              <TabsTrigger value="code">
                <Code aria-hidden="true" />
                Project
              </TabsTrigger>
              <TabsTrigger value="deploy">
                <FileCode aria-hidden="true" />
                Deploy Script
              </TabsTrigger>
              <TabsTrigger value="cli">
                <Terminal aria-hidden="true" />
                CLI Command
              </TabsTrigger>
              <TabsTrigger value="validation" className="group">
                {validationIcon}
                Validation
              </TabsTrigger>
              <TabsTrigger value="graph">
                <Gem aria-hidden="true" />
                Graph
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

          <TabsContent value="graph" className="m-0 flex-1 overflow-hidden">
            <DiamondGraph className="h-full" />
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
                  Local compiler and adapter check · not a security audit or
                  deployment approval.
                </p>
                {currentCompileResult && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {allFacets.length} facet(s) · {selectors.length} selector(s) ·{" "}
                    {storage.length} storage slot(s)
                    {collisionCount > 0 && (
                      <span className="text-destructive"> · {collisionCount} collision(s)</span>
                    )}
                  </p>
                )}
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
                      {currentCompileResult.validation.creationHash && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                          {currentCompileResult.validation.creationHash}
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border p-3">
                      <strong>Runtime bytecode</strong>
                      <p className="text-muted-foreground">
                        {currentCompileResult.validation.runtimeBytes ?? 0} bytes
                      </p>
                      {currentCompileResult.validation.runtimeHash && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                          {currentCompileResult.validation.runtimeHash}
                        </p>
                      )}
                    </div>
                  </div>

                  {validationMessages.length > 0 && (
                    <ul className="space-y-2 text-sm" role="list">
                      {validationMessages.map((message) => (
                        <li key={message} className="text-destructive">{message}</li>
                      ))}
                    </ul>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold">Selectors</h3>
                      <span className="text-xs text-muted-foreground">
                        {selectors.length} exported function(s)
                      </span>
                    </div>
                    {selectors.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No selectors available yet.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40 text-left">
                              <th className="px-3 py-2 font-medium">Selector</th>
                              <th className="px-3 py-2 font-medium">Signature</th>
                              <th className="px-3 py-2 font-medium">Facet</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectors.map((entry) => (
                              <SelectorRow
                                key={`${entry.facet}-${entry.signature}-${entry.selector}`}
                                entry={entry}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold">Storage slots</h3>
                      <span className="text-xs text-muted-foreground">
                        {storage.length} ERC-8042 slot(s)
                      </span>
                    </div>
                    {storage.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No storage positions declared in selected facets.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40 text-left">
                              <th className="px-3 py-2 font-medium">Label</th>
                              <th className="px-3 py-2 font-medium">Constant</th>
                              <th className="px-3 py-2 font-medium">Facets</th>
                            </tr>
                          </thead>
                          <tbody>
                            {storage.map((entry) => (
                              <StorageRow key={entry.label} entry={entry} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {currentCompileResult.diagnostics.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Compiler diagnostics</h3>
                      {currentCompileResult.diagnostics.map((diagnostic, index) => (
                        <pre
                          key={`${diagnostic.severity}-${index}`}
                          className={`whitespace-pre-wrap text-xs ${
                            diagnostic.severity === "error"
                              ? "text-destructive"
                              : diagnostic.severity === "warning"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {diagnostic.message}
                        </pre>
                      ))}
                    </div>
                  )}

                  {isValidated && (
                    <p className="text-sm text-green-500">
                      No compiler errors. Constructor, fallback, EVM size,
                      exportSelectors and selector uniqueness checks passed.
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

function SelectorRow({ entry }: { entry: SelectorEntry }) {
  return (
    <tr
      className={`border-b last:border-b-0 ${entry.collision ? "bg-destructive/10" : ""}`}
    >
      <td className="px-3 py-2 font-mono text-xs">{entry.selector}</td>
      <td className="px-3 py-2">{entry.signature}</td>
      <td className={`px-3 py-2 ${entry.collision ? "text-destructive font-medium" : "text-muted-foreground"}`}>
        {entry.facet}
        {entry.collision && <span className="ml-2 text-xs">collision</span>}
      </td>
    </tr>
  )
}

function StorageRow({ entry }: { entry: StorageEntry }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2 font-medium">{entry.label}</td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
        keccak256("{entry.label}")
        <span className="block text-[10px] opacity-70">{entry.constant}</span>
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {entry.facets.join(", ")}
      </td>
    </tr>
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
  const facets = selectedFacetNames(selection, config)
  const entries = facets.map((facet) => resolveFacetEntry(selection, facet)).filter(Boolean)
  const constructorEntries = [
    ...new Map(
      entries
        .flatMap((entry) => (Array.isArray(entry.constructor) ? entry.constructor : []))
        .map((entry) => [entry.code, entry]),
    ).values(),
  ]
  const initializerModules = [
    ...new Set(
      entries
        .filter((entry) => (Array.isArray(entry.constructor) && entry.constructor.length > 0) && entry.mod)
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
  const facets = selectedFacetNames(selection, config)

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

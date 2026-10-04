import { useEffect, useMemo, useState } from "react"
import { useLaunchpadStore } from "@/lib/state/store"
import { resolveCatalogSelection, uniqueStrings } from "@/lib/compose-core"
import { planComposition } from "@/lib/compose-core"
import type { CompositionPlan } from "@/lib/compose-core"
import { compileDiamond } from "@/lib/compose-core/compiler"
import type {
  CompileFacetInput,
  DiamondCompileResult,
} from "@/lib/compose-core/compiler"
import type { DiamondConfig, Framework, HardhatToolbox } from "@/types/config"
import type { BasesCatalog, CatalogSelection } from "@/types/catalog"
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
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Network,
} from "lucide-react"
import { WorkspaceLayout } from "./WorkspaceLayout"
import { useProjectFileSelection } from "./workspaceViewState"
import { WorkspaceSourceViewport } from "./WorkspaceSourceViewport"
import { ProjectDataPanel, GasEstimatePanel, SelectorRow, StorageRow } from "./WorkspaceProjectReview"
import { DiamondGraph } from "@/components/graph/DiamondGraph"

type ProjectFile = {
  path: string
  source: string
  kind: "generated" | "facet" | "module" | "script"
  language: "solidity" | "typescript"
}

function selectedFacetNames(
  selection: CatalogSelection,
  config: {
    selectedExtensions: string[]
    selectedLibraries: string[]
    selectedAccessExtensions?: string[]
  },
) {
  return uniqueStrings([
    ...Object.keys(selection.requiredFacets),
    ...config.selectedExtensions,
    ...config.selectedLibraries,
    ...(config.selectedAccessExtensions ?? []),
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

export function PreviewArea({ presentation = "classic" }: { presentation?: "classic" | "workspace" }) {
  const { catalog, activeProject, setConfig } = useLaunchpadStore()
  const config = activeProject?.config
  const [compileResult, setCompileResult] = useState<DiamondCompileResult>()
  const [compileError, setCompileError] = useState<string>()
  const [compiledSource, setCompiledSource] = useState("")
  const [failedSource, setFailedSource] = useState("")
  const [loadedFiles, setLoadedFiles] = useState<{ config: DiamondConfig; files: ProjectFile[] }>()
  const [selectedFile, setSelectedFile] = useProjectFileSelection(activeProject?.id, presentation === "workspace")

  const selection = useMemo(() => {
    if (!catalog || !config) return null
    return resolveCatalogSelection(
      catalog,
      config.baseKey,
      config.selectedLibraries,
      config.selectedExtensions,
      config.selectedAccess,
      config.selectedAccessExtensions,
    )
  }, [catalog, config])

  const plan = useMemo(
    () => (catalog && config ? planComposition(catalog, config) : null),
    [catalog, config],
  )

  const diamondCode = useMemo(() => {
    if (!catalog || !plan || !config) return ""
    return generateDiamondCode(plan, catalog)
  }, [catalog, plan, config])

  const facetNames = useMemo(
    () => (plan ? plan.facets.map((facet) => facet.name) : []),
    [plan],
  )

  const deployScript = useMemo(
    () => (selection && config ? generateDeployScript(selection, config) : ""),
    [selection, config],
  )

  useEffect(() => {
    if (!catalog || !selection || !plan || !config) return
    let cancelled = false
    const entries = facetNames.flatMap((name) => {
      const entry = resolveFacetEntry(selection, name)
      return entry ? [{ name, entry }] : []
    })
    const add = (files: ProjectFile[], file: ProjectFile) => {
      if (!files.some((item) => item.path === file.path)) files.push(file)
    }
    const nextFiles: ProjectFile[] = [
      {
        path: "src/Diamond.sol",
        source: diamondCode,
        kind: "generated",
        language: "solidity",
      },
      {
        path: config.framework === "foundry" ? "script/Deploy.s.sol" : "scripts/deploy.ts",
        source: deployScript,
        kind: "script",
        language: config.framework === "foundry" ? "solidity" : "typescript",
      },
    ]
    fetch(`${import.meta.env.BASE_URL}compiler/compose-sources.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Compose source manifest unavailable.")
        return response.json() as Promise<{ sources: Record<string, string> }>
      })
      .then(async (manifest) => {
        for (const { name, entry } of entries) {
          const displayPath = `src/facets/${name}.sol`
          if (entry.path.startsWith("./src/templates/")) {
            const response = await fetch(templateUrl(entry.path))
            if (response.ok)
              add(nextFiles, {
                path: displayPath,
                source: await response.text(),
                kind: "facet",
                language: "solidity",
              })
          } else if (manifest.sources[entry.path]) {
            add(nextFiles, {
              path: displayPath,
              source: manifest.sources[entry.path],
              kind: "facet",
              language: "solidity",
            })
          }
        }
        if (cancelled) return
        setLoadedFiles({ config, files: nextFiles })
        if (presentation === "classic") {
          setSelectedFile((current) =>
            nextFiles.some((file) => file.path === current) ? current : "src/Diamond.sol",
          )
        }
      })
      .catch(() => {
        if (cancelled) return
        setLoadedFiles({ config, files: nextFiles })
        if (presentation === "classic") setSelectedFile("src/Diamond.sol")
      })
    return () => { cancelled = true }
  }, [catalog, selection, plan, facetNames, diamondCode, config, deployScript, presentation])

  const compileIdentity = JSON.stringify({ diamondCode, config })

  useEffect(() => {
    if (!catalog || !selection || !plan || !config || !diamondCode) return
    const controller = new AbortController()
    let cancelled = false

    loadFacetCompileInputs(selection, config)
      .then(async (facetInputs) => {
        if (cancelled || controller.signal.aborted) return
        const result = await compileDiamond(diamondCode, facetInputs, controller.signal)
        if (cancelled) return
        setCompileResult(result)
        setCompiledSource(compileIdentity)
        setCompileError(undefined)
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return
        setCompileError(error instanceof Error ? error.message : "Compilation failed.")
        setFailedSource(compileIdentity)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [catalog, selection, plan, diamondCode, config, compileIdentity])

  if (!catalog || !selection || !plan || !config) return null

  const allFacets = facetNames
  const currentCompileResult = compiledSource === compileIdentity ? compileResult : undefined
  const currentCompileError = failedSource === compileIdentity ? compileError : undefined
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
  const deployFile: ProjectFile = {
    path: config.framework === "foundry" ? "script/Deploy.s.sol" : "scripts/deploy.ts",
    source: deployScript,
    kind: "script",
    language: config.framework === "foundry" ? "solidity" : "typescript",
  }
  // Generated source always reflects the current config, even while facet files load.
  const displayFiles: ProjectFile[] = [
    { path: "src/Diamond.sol", source: diamondCode, kind: "generated", language: "solidity" },
    deployFile,
    ...(presentation === "workspace"
      ? plan.facets.map(({ name }) => {
          const path = `src/facets/${name}.sol`
          return loadedFiles?.config === config
            ? loadedFiles.files.find((file) => file.path === path) ?? {
                path, source: "// Source unavailable. Try reloading the project.", kind: "facet" as const, language: "solidity" as const,
              }
            : { path, source: "// Loading source…", kind: "facet" as const, language: "solidity" as const }
        })
      : loadedFiles?.config === config
        ? loadedFiles.files.filter((file) => file.kind === "facet" || file.kind === "module")
        : []),
  ]
  const currentFile = displayFiles.find((file) => file.path === selectedFile) ?? {
    path: "src/Diamond.sol",
    source: diamondCode,
    kind: "generated" as const,
    language: "solidity" as const,
  }
  const groupedFiles = displayFiles.reduce<Record<string, ProjectFile[]>>((groups, file) => {
    const separator = file.path.lastIndexOf("/")
    const folder = separator === -1 ? "Project root" : file.path.slice(0, separator)
    ;(groups[folder] ??= []).push(file)
    return groups
  }, {})
  const compileStatus = compiling
    ? "Compiling"
    : currentCompileError
      ? "Compiler unavailable"
      : isValidated
        ? "Compiled"
        : "Needs review"
  const validationIcon = compiling ? (
    <Loader2
      className="mr-2 size-4 animate-spin text-amber-600 motion-reduce:animate-none group-data-[state=active]:text-amber-300 dark:text-amber-400 dark:group-data-[state=active]:text-amber-600"
      aria-hidden="true"
    />
  ) : currentCompileError || hasCompilerErrors || validationMessages.length > 0 ? (
    <AlertTriangle
      className="mr-2 size-4 text-destructive group-data-[state=active]:text-red-300 dark:group-data-[state=active]:text-red-700"
      aria-hidden="true"
    />
  ) : isValidated ? (
    <CheckCircle2
      className="mr-2 size-4 text-green-600 group-data-[state=active]:text-green-300 dark:text-green-400 dark:group-data-[state=active]:text-green-700"
      aria-hidden="true"
    />
  ) : (
    <ShieldCheck className="mr-2 size-4" aria-hidden="true" />
  )

  const projectToolbar = (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-md font-semibold">Your Project</h1>
          <span className="hidden text-sm text-muted-foreground sm:inline" aria-hidden="true">·</span>
          <p className="text-sm text-muted-foreground">
            {allFacets.length} {allFacets.length === 1 ? "facet" : "facets"} selected
          </p>
        </div>
        <div className={presentation === "workspace" ? "flex flex-wrap items-center gap-2" : "flex items-center gap-2"}>
          <Badge variant={isValidated ? "secondary" : "outline"} className="gap-1.5" aria-live="polite">
            {validationIcon}
            {compileStatus}
          </Badge>
          <Badge variant="secondary" className="animate-in fade-in">
            {config.baseKey === "none"
              ? "Blank project"
              : selection.selectedBase.standard
                ? `${selection.selectedBase.label} · ${selection.selectedBase.standard}`
                : selection.selectedBase.label}
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
              className="h-7 gap-1 border px-2.5 py-0.5 text-xs font-semibold shadow-none"
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
  )
  const renderFileExplorer = (onSelect?: () => void) => (
              <aside className={presentation === "workspace" ? "h-full min-w-0 overflow-y-auto p-3" : "w-64 max-md:w-44 shrink-0 overflow-y-auto border-r p-3"} aria-label="Project files">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Files</div>
                  <span className="text-xs tabular-nums text-muted-foreground" aria-label={`${displayFiles.length || 1} files`}>
                    {displayFiles.length || 1}
                  </span>
                </div>
                  <div className="space-y-4">
                    {Object.entries(groupedFiles).map(([folder, files]) => (
                      <div key={folder}>
                        <div className="mb-0.5 px-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                          {folder}
                        </div>
                        <div className="space-y-0.5">
                          {files.map((file) => (
                            <button
                              key={file.path}
                              type="button"
                              title={file.path}
                              aria-current={file.path === currentFile.path ? "page" : undefined}
                              className={`w-full rounded px-2 py-1 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${file.path === currentFile.path ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                              onClick={() => { setSelectedFile(file.path); onSelect?.() }}
                            >
                              <span className="block truncate font-medium">{file.path.split("/").pop()}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
              </aside>
  )
  const sourceViewer = presentation === "workspace" ? <WorkspaceSourceViewport projectId={activeProject?.id} filePath={currentFile.path} source={currentFile.source} language={currentFile.language} /> : (
              <div className="min-w-0 flex-1 p-4 h-full overflow-auto">
                <CodeBlock
                  presentation={presentation}
                  code={currentFile.source}
                  language={currentFile.language}
                  className="h-full"
                />
              </div>
  )
  const inspection = (
            <div className="p-4 space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">
                  {compiling
                    ? "Compiling with pinned solc 0.8.30..."
                      : currentCompileError
                      ? "Compiler unavailable"
                      : isValidated
                        ? "Project passed local checks"
                        : "Project needs review"}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Local compiler and integration checks · not a security audit or
                  deployment approval.
                </p>
                {currentCompileResult && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {allFacets.length} facet(s) · {selectors.length} function selector(s) ·{" "}
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
                  <div className="grid grid-cols-2 gap-3 text-sm max-md:grid-cols-1">
                    <div className="rounded-lg border p-3">
                      <strong>Creation bytecode</strong>
                      <p className="text-muted-foreground">
                        {currentCompileResult.validation.creationBytes ?? 0} bytes
                      </p>
                      {currentCompileResult.validation.creationHash && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-primary">Show hash</summary>
                          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                            {currentCompileResult.validation.creationHash}
                          </p>
                        </details>
                      )}
                    </div>
                    <div className="rounded-lg border p-3">
                      <strong>Runtime bytecode</strong>
                      <p className="text-muted-foreground">
                        {currentCompileResult.validation.runtimeBytes ?? 0} bytes
                      </p>
                      {currentCompileResult.validation.runtimeHash && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-primary">Show hash</summary>
                          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                            {currentCompileResult.validation.runtimeHash}
                          </p>
                        </details>
                      )}
                    </div>
                  </div>

                  {validationMessages.length > 0 && (
                    <ul className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
                      {validationMessages.map((message) => (
                        <li key={message} className="flex gap-2 text-destructive">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          <span>{message}</span>
                        </li>
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
                        <table className="w-full text-sm" aria-label="Exported function selectors">
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
                        <table className="w-full text-sm" aria-label="Storage slots">
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
                          className={`whitespace-pre-wrap rounded-md border p-3 text-xs ${
                            diagnostic.severity === "error"
                              ? "border-destructive/30 bg-destructive/5 text-destructive"
                              : diagnostic.severity === "warning"
                                ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
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
  )

  if (presentation === "workspace") {
    return <WorkspaceLayout toolbar={projectToolbar} explorer={renderFileExplorer} source={sourceViewer} projectData={<ProjectDataPanel currentCompileResult={currentCompileResult} compiling={compiling} currentCompileError={currentCompileError} />} gasEstimate={<GasEstimatePanel currentCompileResult={currentCompileResult} compiling={compiling} currentCompileError={currentCompileError} />} filePath={currentFile.path} onSourceSelect={(path) => { if (displayFiles.some((file) => file.path === path)) setSelectedFile(path) }} />
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {projectToolbar}

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="code" className="h-full flex flex-col">
          <div className="border-b bg-muted/25 px-3 py-2">
            <TabsList className="grid h-auto w-full grid-cols-3">
              <TabsTrigger value="code" aria-label="Project files" title="Project files">
                <Code aria-hidden="true" className="mr-2"/>
                <span className="hidden sm:inline">Code</span>
              </TabsTrigger>
              <TabsTrigger value="graph" aria-label="Graph" title="Graph">
                <Network aria-hidden="true" className="mr-2"/>
                <span className="hidden sm:inline">Graph</span>
              </TabsTrigger>
              <TabsTrigger value="validation" className="group" aria-label="Validation" title="Validation">
                {validationIcon}
                <span className="hidden sm:inline">Inspect</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="code" className="flex-1 overflow-auto m-0">
            <div className="flex h-full min-h-0">
              {renderFileExplorer()}
              {sourceViewer}
            </div>
          </TabsContent>

          <TabsContent value="graph" className="m-0 flex-1 overflow-hidden">
            <DiamondGraph className="h-full" />
          </TabsContent>

          <TabsContent value="validation" className="flex-1 overflow-auto m-0">
            {inspection}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function generateDiamondCode(
  plan: CompositionPlan,
  catalog: BasesCatalog,
): string {
  const pragma = catalog.globals.diamond?.pragma || ">=0.8.30"
  const facets = plan.facets.map((facet) => facet.name)
  const constructorEntries = plan.constructorEntries
  const initializerModules = plan.initializerModules
  const interfaces = plan.interfaces
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
${facets.map(f => `import {${f}} from "../src/facets/${f}.sol";`).join("\n")}

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

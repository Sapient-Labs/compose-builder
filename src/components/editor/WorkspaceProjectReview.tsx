import { useState } from "react"
import { AlertTriangle, Fuel, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  ContractGasEstimates,
  DiamondCompileResult,
  GasEstimateValue,
  SelectorEntry,
  StorageEntry,
} from "@/lib/compose-core/compiler"

export type ProjectReviewProps = {
  currentCompileResult?: DiamondCompileResult
  compiling: boolean
  currentCompileError?: string
}

/** Keep this component mounted when leaving Project mode to retain its active tab. */
export function ProjectDataPanel(props: ProjectReviewProps) {
  const [tab, setTab] = useState("selectors")
  const { currentCompileResult, compiling, currentCompileError } = props
  const ready = !compiling && !currentCompileError && !!currentCompileResult &&
    !currentCompileResult.diagnostics.some((diagnostic) => diagnostic.severity === "error")
  const selectors = ready ? currentCompileResult.validation.selectors : []
  const storage = ready ? currentCompileResult.validation.storage : []

  return (
    <Tabs value={tab} onValueChange={setTab} className="h-full min-h-0 gap-0">
      <div className="workspace-pane-header min-w-0 gap-2 border-b bg-muted/25 px-3">
        <TabsList aria-label="Project data">
          <TabsTrigger value="selectors">Selectors{ready && <span className="ml-1 tabular-nums">{selectors.length}</span>}</TabsTrigger>
          <TabsTrigger value="storage">Storage{ready && <span className="ml-1 tabular-nums">{storage.length}</span>}</TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!ready ? <CompileState {...props} subject="project data" /> : (
          <>
            <ReviewMessages result={currentCompileResult} />
            <TabsContent value="selectors" className="m-0 space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Function selectors</h2>
                <p className="mt-1 text-xs text-muted-foreground">Exported functions in the selected facets. Selector collisions are highlighted.</p>
              </div>
              {selectors.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm" aria-label="Exported function selectors">
                    <thead><tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2 font-medium">Selector</th>
                      <th className="px-3 py-2 font-medium">Signature</th>
                      <th className="px-3 py-2 font-medium">Facet</th>
                    </tr></thead>
                    <tbody>{selectors.map((entry) => <SelectorRow key={`${entry.facet}-${entry.signature}-${entry.selector}`} entry={entry} />)}</tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-muted-foreground">No selectors available for this project.</p>}
            </TabsContent>
            <TabsContent value="storage" className="m-0 space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Storage positions</h2>
                <p className="mt-1 text-xs text-muted-foreground">Named storage positions declared in selected facet source. This is not a full compiler storage layout.</p>
              </div>
              {storage.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm" aria-label="Storage slots">
                    <thead><tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2 font-medium">Label</th>
                      <th className="px-3 py-2 font-medium">Constant</th>
                      <th className="px-3 py-2 font-medium">Facets</th>
                    </tr></thead>
                    <tbody>{storage.map((entry) => <StorageRow key={entry.label} entry={entry} />)}</tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-muted-foreground">No storage positions declared in selected facets.</p>}
            </TabsContent>
          </>
        )}
      </div>
    </Tabs>
  )
}

export function GasEstimatePanel(props: ProjectReviewProps) {
  const { currentCompileResult, compiling, currentCompileError } = props
  const ready = !compiling && !currentCompileError && !!currentCompileResult &&
    !currentCompileResult.diagnostics.some((diagnostic) => diagnostic.severity === "error")
  const estimates = ready ? currentCompileResult.gasEstimates : undefined

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="workspace-pane-header gap-2 border-b bg-muted/25 px-3 text-xs font-medium">
        <Fuel className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2>Gas estimate</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!ready ? <CompileState {...props} subject="gas estimates" /> : !estimates?.contracts.length ? (
          <div className="space-y-2" role="status">
            <h3 className="text-sm font-semibold">Gas estimates unavailable</h3>
            <p className="text-xs text-muted-foreground">The current compiler result did not return static gas estimates. No deployment or transaction estimate has been made.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <h3 className="text-sm font-semibold">Static compiler estimates</h3>
              <p className="text-xs text-muted-foreground">solc {estimates.compilerVersion} · optimizer {estimates.optimizer.enabled ? `${estimates.optimizer.runs} runs` : "disabled"} · EVM {estimates.evmVersion}</p>
              <p className="text-xs text-muted-foreground">Values are gas units for individual compiled contracts. Transaction overhead, Diamond routing and network fees are not included. Actual deployment and calls require simulation with their arguments.</p>
              <p className="text-xs text-muted-foreground">“Not statically estimable” means solc returned “infinite”; it does not mean the operation necessarily fails.</p>
            </div>
            {estimates.contracts.map((contract) => <ContractGasCard key={`${contract.source}:${contract.contract}`} estimates={contract} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function CompileState({ currentCompileResult, compiling, currentCompileError, subject }: ProjectReviewProps & { subject: string }) {
  if (compiling) return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Compiling {subject}…
    </div>
  )
  const errors = currentCompileResult?.diagnostics.filter((diagnostic) => diagnostic.severity === "error") ?? []
  if (currentCompileError || errors.length) return (
    <div className="space-y-2" role="alert">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="size-4" aria-hidden="true" />{currentCompileError ? "Compiler unavailable" : "Compilation failed"}</h3>
      <p className="text-xs text-muted-foreground">Current {subject} cannot be shown until compilation succeeds.</p>
      {currentCompileError && <p className="break-words text-sm text-destructive">{currentCompileError}</p>}
      {errors.map((diagnostic, index) => <pre key={index} className="whitespace-pre-wrap break-words text-xs text-destructive">{diagnostic.message}</pre>)}
    </div>
  )
  return <p className="text-sm text-muted-foreground" role="status">Compile the project to see {subject}.</p>
}

function ReviewMessages({ result }: { result: DiamondCompileResult }) {
  const messages = result.validation.messages
  const diagnostics = result.diagnostics.filter((diagnostic) => diagnostic.severity !== "error")
  if (!messages.length && !diagnostics.length) return null
  return (
    <div className="mb-4 space-y-2">
      {messages.length > 0 && <ul className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
        {messages.map((message) => <li key={message}>{message}</li>)}
      </ul>}
      {diagnostics.length > 0 && <details className="rounded-lg border p-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Compiler diagnostics ({diagnostics.length})</summary>
        {diagnostics.map((diagnostic, index) => <pre key={index} className="mt-2 whitespace-pre-wrap break-words">{diagnostic.message}</pre>)}
      </details>}
    </div>
  )
}

function formatGas(value?: GasEstimateValue) {
  if (value === undefined) return "Unavailable"
  if (value === "infinite") return "Not statically estimable"
  return `${BigInt(value).toLocaleString("en-US")} gas`
}

function ContractGasCard({ estimates }: { estimates: ContractGasEstimates }) {
  const creation = estimates.creation
  return (
    <section className="min-w-0 space-y-3 rounded-lg border p-3" aria-label={`${estimates.contract} gas estimates`}>
      <div>
        <h3 className="break-words text-sm font-semibold">{estimates.contract}</h3>
        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{estimates.source}</p>
      </div>
      {creation && <div className="space-y-2">
        <h4 className="text-xs font-medium">Contract creation</h4>
        <dl className="space-y-2 text-xs">
          {([
            ["Code deposit", creation.codeDepositCost],
            ["Execution", creation.executionCost],
            ["solc creation total", creation.totalCost],
          ] as const).map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="text-muted-foreground">{label}</dt><dd className="tabular-nums">{formatGas(value)}</dd></div>)}
        </dl>
      </div>}
      {Object.keys(estimates.external).length > 0 && <GasFunctionList label="External functions" values={estimates.external} />}
      {Object.keys(estimates.internal).length > 0 && <details className="text-xs">
        <summary className="cursor-pointer font-medium">Internal functions ({Object.keys(estimates.internal).length})</summary>
        <div className="mt-2"><GasFunctionList label="Internal function estimates" values={estimates.internal} /></div>
      </details>}
    </section>
  )
}

function GasFunctionList({ label, values }: { label: string; values: Record<string, GasEstimateValue> }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium">{label}</h4>
      <dl className="divide-y text-xs">
        {Object.entries(values).map(([signature, value]) => <div key={signature} className="space-y-1 py-2 first:pt-0 last:pb-0">
          <dt className="break-all font-mono text-muted-foreground">{signature || "Fallback / receive"}</dt>
          <dd className="tabular-nums">{formatGas(value)}</dd>
        </div>)}
      </dl>
    </div>
  )
}

// Shared with classic Inspect. Its row presentation stays unchanged.
export function SelectorRow({ entry }: { entry: SelectorEntry }) {
  return (
    <tr className={`border-b last:border-b-0 ${entry.collision ? "bg-destructive/10" : ""}`}>
      <td className="px-3 py-2 font-mono text-xs">{entry.selector}</td>
      <td className="px-3 py-2">{entry.signature}</td>
      <td className={`px-3 py-2 ${entry.collision ? "text-destructive font-medium" : "text-muted-foreground"}`}>
        {entry.facet}
        {entry.collision && <span className="ml-2 text-xs">collision</span>}
      </td>
    </tr>
  )
}

export function StorageRow({ entry }: { entry: StorageEntry }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2 font-medium">{entry.label}</td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
        keccak256("{entry.label}")
        <span className="block text-[10px] opacity-70">{entry.constant}</span>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{entry.facets.join(", ")}</td>
    </tr>
  )
}

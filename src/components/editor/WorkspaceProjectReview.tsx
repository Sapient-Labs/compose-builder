import { useEffect, useState } from "react"
import { AlertTriangle, Check, Copy, Fuel, Loader2, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  DiamondCompileResult,
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

export function GasEstimatePanel(props: ProjectReviewProps & { cliCommand: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="workspace-pane-header gap-2 border-b bg-muted/25 px-3 text-xs font-medium">
        <h2>Project summary</h2>
      </div>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        <section className="min-w-0 shrink-0 space-y-2 rounded-lg border p-3" aria-label="Diamond deployment gas">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Fuel className="size-4 text-muted-foreground" aria-hidden="true" />Gas estimate</h3>
          <p className="text-xs text-muted-foreground">Diamond deployment</p>
          <DiamondCreationEstimate {...props} />
        </section>
        <ComposeCommandBox key={props.cliCommand} command={props.cliCommand} />
      </div>
    </div>
  )
}

function DiamondCreationEstimate({ currentCompileResult, compiling, currentCompileError }: ProjectReviewProps) {
  if (compiling) return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
      <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />Compiling gas estimate…
    </p>
  )
  if (currentCompileError || currentCompileResult?.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return <p className="text-xs text-destructive" role="alert">{currentCompileError ? "Compiler unavailable." : "Compilation failed."} Gas estimate unavailable.</p>
  }
  if (!currentCompileResult) {
    return <p className="text-xs text-muted-foreground" role="status">Compile the project to estimate Diamond deployment gas.</p>
  }

  // Match the generated compiler source exactly; another contract's creation
  // cost or Diamond's code-deposit component is never a deployment total.
  const total = currentCompileResult.gasEstimates?.contracts.find((estimate) =>
    estimate.contract === "Diamond" && estimate.source === "contracts/Diamond.sol",
  )?.creation?.totalCost
  if (total === "infinite") {
    return <p className="text-xs text-muted-foreground" role="status">Not statically estimable. solc returned an unbounded creation cost.</p>
  }
  if (typeof total !== "string" || !/^\d+$/.test(total)) {
    return <p className="text-xs text-muted-foreground" role="status">Gas estimate unavailable. No valid Diamond creation total in the current result.</p>
  }
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{BigInt(total).toLocaleString("en-US")} gas</p>
      <p className="mt-1 text-xs text-muted-foreground">Static solc creation estimate. Actual deployment requires simulation.</p>
    </div>
  )
}

/** Presentation only: preserve quoted/escaped values, never change the copied command. */
function formatCommandPreview(command: string) {
  let formatted = ""
  let quote = ""
  for (let index = 0; index < command.length; index++) {
    const char = command[index]
    if (char === "\\" && quote !== "'") {
      formatted += char + (command[++index] ?? "")
      continue
    }
    if (char === "'" || char === '"') {
      if (!quote) quote = char
      else if (quote === char) quote = ""
    }
    if (!quote && char === " " && /^--[a-z][a-z-]*(?:\s|=|$)/i.test(command.slice(index + 1))) {
      formatted += "\n  "
    } else formatted += char
  }
  return formatted
}

function ComposeCommandBox({ command }: { command: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "error">("idle")
  useEffect(() => {
    if (copyState !== "copied") return
    const timer = window.setTimeout(() => setCopyState("idle"), 2000)
    return () => window.clearTimeout(timer)
  }, [copyState])

  const copyCommand = async () => {
    setCopyState("copying")
    try {
      await navigator.clipboard.writeText(command)
      setCopyState("copied")
    } catch {
      setCopyState("error")
    }
  }

  return (
    <section className="min-w-0 shrink-0 overflow-hidden rounded-lg border border-[#263142] bg-[#0b0e14] text-[#e0e7f0]" aria-label="Compose CLI command">
      <div className="flex items-center justify-between gap-2 border-b border-[#263142] bg-[#141a24] px-3 py-2">
        <h3 className="flex items-center gap-2 font-mono text-xs font-medium"><Terminal className="size-3.5 text-slate-400" aria-hidden="true" />Compose command</h3>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-slate-300 hover:bg-[#253044] hover:text-white focus-visible:ring-slate-400" onClick={copyCommand} disabled={copyState === "copying"} aria-label="Copy Compose command" title="Copy the runnable command as one line">
          {copyState === "copied" ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
          {copyState === "copied" ? "Copied" : copyState === "copying" ? "Copying…" : "Copy"}
        </Button>
      </div>
      <div className="flex min-w-0 items-start gap-3 px-3 py-3 font-mono text-xs leading-relaxed">
        <span aria-hidden="true" className="shrink-0 cursor-default select-none text-emerald-300">$</span>
        <pre tabIndex={0} aria-label="Command preview" className="min-w-0 flex-1 max-h-40 cursor-default caret-transparent overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-slate-400 [overflow-wrap:anywhere]"><code aria-label="Compose command" className="cursor-default caret-transparent">{copyState === "error" ? command : formatCommandPreview(command)}</code></pre>
      </div>
      <p className="px-3 pb-2 text-[10px] text-slate-400">Copy returns one runnable line.</p>
      {copyState === "error" ? (
        <p className="px-3 pb-3 text-xs text-rose-300" role="alert">Copy failed. Select and copy the command manually.</p>
      ) : <span className="sr-only" role="status" aria-live="polite">{copyState === "copied" ? "Compose command copied." : ""}</span>}
    </section>
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

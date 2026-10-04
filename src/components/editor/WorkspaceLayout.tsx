import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Code, FolderOpen, Hammer, Network, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, X } from "lucide-react"
import { DiamondSetupPanel } from "./DiamondSetupPanel"
import { DiamondGraph } from "@/components/graph/DiamondGraph"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { readWorkspacePaneLayout, writeWorkspacePaneLayout } from "./workspaceViewState"
import "./workspace.css"

type Props = {
  mode: "builder" | "project"
  onModeChange: (mode: "builder" | "project") => void
  toolbar: ReactNode
  explorer: (onSelect: () => void) => ReactNode
  source: ReactNode
  projectData: ReactNode
  gasEstimate: ReactNode
  filePath: string
  onSourceSelect?: (path: string) => void
}

const MIN_RATIO = 0.2
const MAX_RATIO = 0.8

const clampRatio = (value: number) =>
  Math.min(MAX_RATIO, Math.max(MIN_RATIO, Math.round(value * 100) / 100))

/** Keep both modes mounted: switching review never discards source position or graph selection. */
export function WorkspaceLayout({ mode, onModeChange, toolbar, explorer, source, projectData, gasEstimate, filePath, onSourceSelect }: Props) {
  const builder = mode === "builder"
  const [initialLayout] = useState(readWorkspacePaneLayout)
  const [codeOpen, setCodeOpen] = useState(initialLayout.codeOpen)
  const [graphOpen, setGraphOpen] = useState(initialLayout.graphOpen)
  const [splitRatio, setSplitRatio] = useState(initialLayout.splitRatio)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const sidebarVisible = builder && sidebarOpen
  const [sidebarTab, setSidebarTab] = useState("config")
  const [desktop, setDesktop] = useState(() => window.matchMedia?.("(min-width: 1000px)").matches ?? true)
  const [dragging, setDragging] = useState(false)
  const projectRegion = useRef<HTMLElement>(null)
  const focusReview = useRef(false)
  const mainRef = useRef<HTMLDivElement>(null)
  const splitterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const query = window.matchMedia?.("(min-width: 1000px)")
    if (!query) return
    const onChange = () => setDesktop(query.matches)
    query.addEventListener?.("change", onChange)
    return () => query.removeEventListener?.("change", onChange)
  }, [])

  useEffect(() => {
    writeWorkspacePaneLayout({ codeOpen, graphOpen, splitRatio })
  }, [codeOpen, graphOpen, splitRatio])

  useLayoutEffect(() => {
    if (!builder && focusReview.current) {
      projectRegion.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
      focusReview.current = false
    }
  }, [builder])

  const collapseOnSmallScreen = () => {
    if (window.matchMedia?.("(max-width: 767px)").matches) setSidebarOpen(false)
  }

  const review = () => {
    focusReview.current = true
    onModeChange("project")
    collapseOnSmallScreen()
  }

  const onSplitterPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const splitter = splitterRef.current
    const main = mainRef.current
    if (!splitter || !main) return
    const startPos = desktop ? event.clientX : event.clientY
    const splitterSize = desktop ? splitter.offsetWidth : splitter.offsetHeight
    const total = (desktop ? main.clientWidth : main.clientHeight) - splitterSize
    const startRatio = splitRatio
    setDragging(true)
    const element = event.currentTarget
    element.setPointerCapture?.(event.pointerId)
    const onMove = (moveEvent: PointerEvent) => {
      const delta = (desktop ? moveEvent.clientX : moveEvent.clientY) - startPos
      setSplitRatio(clampRatio((startRatio * total - delta) / total))
    }
    const onEnd = () => {
      element.removeEventListener("pointermove", onMove)
      element.removeEventListener("pointerup", onEnd)
      element.removeEventListener("pointercancel", onEnd)
      setDragging(false)
    }
    element.addEventListener("pointermove", onMove)
    element.addEventListener("pointerup", onEnd)
    element.addEventListener("pointercancel", onEnd)
  }

  const onSplitterKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.03
    let next: number | undefined
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = splitRatio + step
    else if (event.key === "ArrowRight" || event.key === "ArrowDown") next = splitRatio - step
    else if (event.key === "Home") next = MIN_RATIO
    else if (event.key === "End") next = MAX_RATIO
    if (next === undefined) return
    event.preventDefault()
    setSplitRatio(clampRatio(next))
  }

  const graphStyle: CSSProperties = !codeOpen
    ? { flex: "1 1 0" }
    : desktop
      ? { width: `${splitRatio * 100}%` }
      : { height: `${splitRatio * 100}%` }

  return (
    <div className="workspace-page flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0">{toolbar}</div>
      <div className="workspace-panes min-h-0 flex-1" data-mode={mode} data-sidebar-open={sidebarVisible}>
        <nav className="workspace-activity flex flex-col items-center gap-2 border-r bg-sidebar py-2" aria-label="Workspace navigation">
          <Button variant="ghost" className="h-auto w-full flex-col gap-1 px-1 py-2 text-[10px]" onClick={() => onModeChange("builder")} aria-pressed={builder}><Hammer className="size-4" />Builder</Button>
          <Button variant="ghost" className="h-auto w-full flex-col gap-1 px-1 py-2 text-[10px]" onClick={() => onModeChange("project")} aria-pressed={!builder}><ShieldCheck className="size-4" />Project</Button>
        </nav>

        {builder && (sidebarVisible ? (
          <aside id="workspace-sidebar" className="workspace-sidebar min-h-0 min-w-0 border-r bg-background" aria-label="Builder configuration and files">
            <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="h-full min-h-0 gap-0">
              <div className="workspace-pane-header border-b px-2">
                <div className="flex items-center gap-1">
                  <TabsList className="grid flex-1 grid-cols-2">
                    <TabsTrigger value="config">Configure</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                  </TabsList>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Collapse sidebar" onClick={() => setSidebarOpen(false)}><PanelLeftClose className="size-4" /></Button>
                </div>
              </div>
              <TabsContent forceMount hidden={sidebarTab !== "config"} value="config" className="m-0 min-h-0 flex-1 overflow-hidden"><DiamondSetupPanel onReview={review} /></TabsContent>
              <TabsContent forceMount hidden={sidebarTab !== "files"} value="files" className="m-0 min-h-0 flex-1 overflow-hidden">{explorer(collapseOnSmallScreen)}</TabsContent>
            </Tabs>
          </aside>
        ) : (
          <aside className="workspace-sidebar-strip flex min-h-0 flex-col items-center gap-2 border-r bg-background py-2" aria-label="Builder configuration and files">
            <Button variant="ghost" size="icon" className="size-8" aria-label="Show configuration" onClick={() => { setSidebarTab("config"); setSidebarOpen(true) }}><Settings className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Show files" onClick={() => { setSidebarTab("files"); setSidebarOpen(true) }}><FolderOpen className="size-4" /></Button>
            <div className="h-px w-6 shrink-0 bg-border" aria-hidden="true" />
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setCodeOpen((open) => !open)} aria-pressed={codeOpen} aria-label={codeOpen ? "Hide code pane" : "Show code pane"} disabled={codeOpen && !graphOpen}><Code className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setGraphOpen((open) => !open)} aria-pressed={graphOpen} aria-label={graphOpen ? "Hide graph pane" : "Show graph pane"} disabled={graphOpen && !codeOpen}><Network className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="size-8 mt-auto" aria-label="Expand sidebar" onClick={() => setSidebarOpen(true)}><PanelLeftOpen className="size-4" /></Button>
          </aside>
        ))}

        <div className="workspace-main" data-orientation={desktop ? "row" : "column"} ref={mainRef} hidden={!builder}>
          {codeOpen && (
            <section className="workspace-review flex min-h-0 min-w-0 flex-col overflow-hidden" aria-label="Source review">
              <div className="workspace-pane-header min-w-0 gap-2 border-b bg-muted/25 px-3">
                <Code className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-xs text-muted-foreground" title={filePath}>{filePath}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">Read only</span>
                {graphOpen
                  ? <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Close code pane" onClick={() => setCodeOpen(false)}><X className="size-3.5" /></Button>
                  : <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Show graph pane" onClick={() => setGraphOpen(true)}><Network className="size-3.5" /></Button>}
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">{source}</div>
            </section>
          )}
          {codeOpen && graphOpen && (
            <div
              className="workspace-splitter"
              ref={splitterRef}
              role="separator"
              aria-orientation={desktop ? "vertical" : "horizontal"}
              aria-label="Resize code and graph panes"
              aria-valuenow={Math.round(splitRatio * 100)}
              tabIndex={0}
              data-dragging={dragging}
              onPointerDown={onSplitterPointerDown}
              onKeyDown={onSplitterKeyDown}
            />
          )}
          {graphOpen && (
            <section className="workspace-graph flex min-h-0 min-w-0 flex-col overflow-hidden" style={graphStyle} aria-label="Composition preview">
              <div className="workspace-pane-header gap-2 border-b bg-muted/25 px-3 text-xs font-medium"><Network className="size-4 text-muted-foreground" />Composition
                {codeOpen
                  ? <Button variant="ghost" size="icon" className="ml-auto size-7 shrink-0" aria-label="Close graph pane" onClick={() => setGraphOpen(false)}><X className="size-3.5" /></Button>
                  : <Button variant="ghost" size="icon" className="ml-auto size-7 shrink-0" aria-label="Show code pane" onClick={() => setCodeOpen(true)}><Code className="size-3.5" /></Button>}
              </div>
              <div className="relative min-h-0 flex-1"><DiamondGraph enableWebGLFallback className="h-full w-full" onSourceSelect={(path) => { onSourceSelect?.(path); setSidebarTab("files"); collapseOnSmallScreen() }} /></div>
            </section>
          )}
        </div>

        <section ref={projectRegion} hidden={builder} className="workspace-review flex min-h-0 min-w-0 flex-col overflow-hidden" aria-label="Project selectors and storage">{projectData}</section>
        <section hidden={builder} className="workspace-graph flex min-h-0 min-w-0 flex-col overflow-hidden border-l" aria-label="Project gas estimate">{gasEstimate}</section>
      </div>
    </div>
  )
}

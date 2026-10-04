import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { Code, Hammer, Network, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react"
import { DiamondSetupPanel } from "./DiamondSetupPanel"
import { DiamondGraph } from "@/components/graph/DiamondGraph"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getWorkspaceModeSnapshot, navigateWorkspace, subscribeToNavigation } from "@/lib/navigation"
import "./workspace.css"

type Props = {
  toolbar: ReactNode
  explorer: (onSelect: () => void) => ReactNode
  source: ReactNode
  projectData: ReactNode
  gasEstimate: ReactNode
  filePath: string
  onSourceSelect?: (path: string) => void
}

/** Keep both modes mounted: switching review never discards source position or graph selection. */
export function WorkspaceLayout({ toolbar, explorer, source, projectData, gasEstimate, filePath, onSourceSelect }: Props) {
  const mode = useSyncExternalStore(subscribeToNavigation, getWorkspaceModeSnapshot, () => "builder")
  const builder = mode === "builder"
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const sidebarVisible = builder && sidebarOpen
  const [sidebarTab, setSidebarTab] = useState("config")
  const projectRegion = useRef<HTMLElement>(null)
  const focusReview = useRef(false)
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
    navigateWorkspace("project")
    collapseOnSmallScreen()
  }

  return (
    <div className="workspace-page flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0">{toolbar}</div>
      <div className="workspace-panes min-h-0 flex-1" data-mode={mode} data-sidebar-open={sidebarVisible}>
        <nav className="workspace-activity flex flex-col items-center gap-2 border-r bg-sidebar py-2" aria-label="Workspace navigation">
          <Button variant="ghost" className="h-auto w-full flex-col gap-1 px-1 py-2 text-[10px]" onClick={() => navigateWorkspace("builder")} aria-pressed={builder}><Hammer className="size-4" />Builder</Button>
          <Button variant="ghost" className="h-auto w-full flex-col gap-1 px-1 py-2 text-[10px]" onClick={() => navigateWorkspace("project")} aria-pressed={!builder}><ShieldCheck className="size-4" />Project</Button>
          {builder && <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? "Collapse builder sidebar" : "Expand builder sidebar"} aria-expanded={sidebarOpen} aria-controls="workspace-sidebar" title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
            {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>}
        </nav>

        <aside id="workspace-sidebar" hidden={!sidebarVisible} className="workspace-sidebar min-h-0 min-w-0 border-r bg-background" aria-label="Builder configuration and files">
          <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="h-full min-h-0 gap-0">
            <div className="workspace-pane-header border-b px-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="config">Configure</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent forceMount hidden={sidebarTab !== "config"} value="config" className="m-0 min-h-0 flex-1 overflow-hidden"><DiamondSetupPanel onReview={review} /></TabsContent>
            <TabsContent forceMount hidden={sidebarTab !== "files"} value="files" className="m-0 min-h-0 flex-1 overflow-hidden">{explorer(collapseOnSmallScreen)}</TabsContent>
          </Tabs>
        </aside>

        <section hidden={!builder} className="workspace-review flex min-h-0 min-w-0 flex-col overflow-hidden" aria-label="Source review">
          <div className="workspace-pane-header min-w-0 gap-2 border-b bg-muted/25 px-3">
            <Code className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-mono text-xs text-muted-foreground" title={filePath}>{filePath}</span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">Read only</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{source}</div>
        </section>

        <section hidden={!builder} className="workspace-graph flex min-h-0 min-w-0 flex-col overflow-hidden border-l" aria-label="Composition preview">
          <div className="workspace-pane-header gap-2 border-b bg-muted/25 px-3 text-xs font-medium"><Network className="size-4 text-muted-foreground" />Composition</div>
          <div className="relative min-h-0 flex-1"><DiamondGraph enableWebGLFallback className="h-full w-full" onSourceSelect={(path) => { onSourceSelect?.(path); setSidebarTab("files"); collapseOnSmallScreen() }} /></div>
        </section>

        <section ref={projectRegion} hidden={builder} className="workspace-review flex min-h-0 min-w-0 flex-col overflow-hidden" aria-label="Project selectors and storage">{projectData}</section>
        <section hidden={builder} className="workspace-graph flex min-h-0 min-w-0 flex-col overflow-hidden border-l" aria-label="Project gas estimate">{gasEstimate}</section>
      </div>
    </div>
  )
}

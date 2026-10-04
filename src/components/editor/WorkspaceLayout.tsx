import { useRef, useState, type ReactNode } from "react"
import { Code, Files, Network, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react"
import { DiamondSetupPanel } from "./DiamondSetupPanel"
import { DiamondGraph } from "@/components/graph/DiamondGraph"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import "./workspace.css"

type Props = {
  toolbar: ReactNode
  explorer: (onSelect: () => void) => ReactNode
  source: ReactNode
  inspection: ReactNode
  filePath: string
  validationIcon: ReactNode
  onSourceSelect?: (path: string) => void
}

/** Presentation only: source generation, compilation and configuration stay in MN's components. */
export function WorkspaceLayout({ toolbar, explorer, source, inspection, filePath, validationIcon, onSourceSelect }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState("config")
  const [reviewTab, setReviewTab] = useState("code")
  const sourceTab = useRef<HTMLButtonElement>(null)

  const collapseOnSmallScreen = () => {
    if (window.matchMedia?.("(max-width: 767px)").matches) setSidebarOpen(false)
  }

  const review = () => {
    setSidebarTab("files")
    setReviewTab("code")
    collapseOnSmallScreen()
    sourceTab.current?.focus()
  }

  return (
    <div className="workspace-page flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0">{toolbar}</div>
      <div className="workspace-panes min-h-0 flex-1" data-sidebar-open={sidebarOpen}>
        <nav className="workspace-activity flex flex-col items-center gap-2 border-r bg-sidebar py-2" aria-label="Workspace panels">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? "Collapse workspace sidebar" : "Expand workspace sidebar"} aria-expanded={sidebarOpen} aria-controls="workspace-sidebar" title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
            {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSidebarTab("config"); setSidebarOpen(true) }} aria-label="Show configuration" aria-pressed={sidebarOpen && sidebarTab === "config"} title="Configuration"><Settings /></Button>
          <Button variant="ghost" size="icon" onClick={() => { setSidebarTab("files"); setSidebarOpen(true) }} aria-label="Show file explorer" aria-pressed={sidebarOpen && sidebarTab === "files"} title="Files"><Files /></Button>
        </nav>

        <aside id="workspace-sidebar" hidden={!sidebarOpen} className="workspace-sidebar min-h-0 min-w-0 border-r bg-background" aria-label="Configuration and files">
          <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="h-full min-h-0 gap-0">
            <div className="workspace-pane-header border-b px-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="config">Configure</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="config" className="m-0 min-h-0 flex-1 overflow-hidden"><DiamondSetupPanel onReview={review} /></TabsContent>
            <TabsContent value="files" className="m-0 min-h-0 flex-1 overflow-hidden">{explorer(collapseOnSmallScreen)}</TabsContent>
          </Tabs>
        </aside>

        <section className="workspace-review min-h-0 min-w-0 overflow-hidden" aria-label="Source and compiler review">
          <Tabs value={reviewTab} onValueChange={setReviewTab} className="h-full min-h-0 gap-0">
            <div className="workspace-pane-header min-w-0 gap-2 border-b bg-muted/25 px-2">
              <TabsList className="shrink-0">
                <TabsTrigger value="code" ref={sourceTab}><Code className="size-4" />Code</TabsTrigger>
                <TabsTrigger value="inspect" className="group">{validationIcon}Inspect</TabsTrigger>
              </TabsList>
              <span className="truncate font-mono text-xs text-muted-foreground" title={filePath}>{filePath}</span>
            </div>
            <TabsContent value="code" className="m-0 min-h-0 flex-1 overflow-hidden">{source}</TabsContent>
            <TabsContent value="inspect" className="m-0 min-h-0 flex-1 overflow-auto">{inspection}</TabsContent>
          </Tabs>
        </section>

        <section className="workspace-graph flex min-h-0 min-w-0 flex-col overflow-hidden border-l" aria-label="Composition preview">
          <div className="workspace-pane-header gap-2 border-b bg-muted/25 px-3 text-xs font-medium"><Network className="size-4 text-muted-foreground" />Composition</div>
          <div className="relative min-h-0 flex-1"><DiamondGraph enableWebGLFallback className="h-full w-full" onSourceSelect={(path) => { onSourceSelect?.(path); setReviewTab("code"); setSidebarTab("files"); collapseOnSmallScreen() }} /></div>
        </section>
      </div>
    </div>
  )
}

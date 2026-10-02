import { useLaunchpadStore } from "@/lib/state/store"
import { ConfigPanel } from "./ConfigPanel"
import { PreviewArea } from "./PreviewArea"
import { DiamondGraph } from "@/components/graph/DiamondGraph"

export function EditorLayout() {
  const { viewMode } = useLaunchpadStore()
  const showConfig = viewMode === "config"
  const showProject = viewMode === "project"

  return (
    <div className="h-full flex overflow-hidden">
      {showConfig && (
        <div className="flex h-full min-w-0 flex-1 overflow-hidden">
          <div className="flex h-full w-[min(28rem,42vw)] shrink-0 flex-col overflow-hidden border-r border-border">
            <ConfigPanel />
          </div>
          <div className="relative h-full min-w-0 flex-1 overflow-hidden">
            <DiamondGraph className="h-full w-full" />
          </div>
        </div>
      )}
      {showProject && (
        <div className="h-full min-w-0 flex-1 overflow-hidden">
          <PreviewArea />
        </div>
      )}
    </div>
  )
}

import { ConfigPanel } from "./ConfigPanel"
import { PreviewArea } from "./PreviewArea"

export function EditorLayout() {
  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Left Side Panel - Configuration */}
      <div className="w-80 flex-shrink-0">
        <ConfigPanel />
      </div>

      {/* Right Main Area - Preview */}
      <div className="flex-1 overflow-hidden">
        <PreviewArea />
      </div>
    </div>
  )
}

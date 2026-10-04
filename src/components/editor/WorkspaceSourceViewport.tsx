import { useLayoutEffect, useRef } from "react"
import { CodeBlock } from "@/components/ui/code-block"
import { readWorkspaceScroll, writeWorkspaceScroll } from "./workspaceViewState"
import type { WorkspaceScrollPosition } from "./workspaceViewState"

type Props = {
  projectId?: string
  filePath: string
  source: string
  language: "solidity" | "typescript"
}

function hasLoadedSource(source: string) {
  const value = source.trim()
  return value.length > 0 && value !== "// Loading source…" && value !== "// Loading source..." &&
    value !== "// Source unavailable. Try reloading the project."
}

/** A selectable, read-only viewer with independent positions for each project file. */
export function WorkspaceSourceViewport({ projectId, filePath, source, language }: Props) {
  const viewport = useRef<HTMLDivElement>(null)
  const positions = useRef(new Map<string, WorkspaceScrollPosition>())
  const identity = JSON.stringify([projectId, filePath])
  const ready = hasLoadedSource(source)

  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const restore = () => {
      // Hidden mode panels have no layout box. Restore after they become visible.
      if (element.closest("[hidden]")) return
      const position = positions.current.get(identity) ?? readWorkspaceScroll(projectId, filePath)
      if (ready) {
        positions.current.set(identity, position)
        element.scrollTop = position.top
        element.scrollLeft = position.left
      } else {
        // A short loading/error message must never replace a real file's position.
        element.scrollTop = 0
        element.scrollLeft = 0
      }
    }
    restore()

    const observer = new MutationObserver(restore)
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ["hidden"] })
    }
    return () => observer.disconnect()
  }, [identity, projectId, filePath, ready, source])

  return (
    <div
      ref={viewport}
      className="min-w-0 flex-1 h-full overflow-auto"
      data-workspace-source-viewport=""
      onScroll={(event) => {
        const element = event.currentTarget
        if (!ready || element.closest("[hidden]")) return
        const position = { top: element.scrollTop, left: element.scrollLeft }
        positions.current.set(identity, position)
        writeWorkspaceScroll(projectId, filePath, position)
      }}
    >
      <CodeBlock presentation="workspace" code={source} language={language} className="h-full" />
    </div>
  )
}

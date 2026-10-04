import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { WorkspaceSourceViewport } from "./WorkspaceSourceViewport"

vi.mock("@/components/ui/code-block", () => ({
  CodeBlock: ({ code, presentation, language, className }: { code: string; presentation: string; language: string; className: string }) =>
    <pre data-presentation={presentation} data-language={language} className={className}>{code}</pre>,
}))

beforeEach(() => window.sessionStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const defaults = { projectId: "first", filePath: "src/Diamond.sol", source: "contract Diamond {}", language: "solidity" as const }
const viewport = (container: HTMLElement) => container.querySelector<HTMLDivElement>("[data-workspace-source-viewport]")!
const scroll = (element: HTMLDivElement, top: number, left: number) => fireEvent.scroll(element, { target: { scrollTop: top, scrollLeft: left } })

it("uses the existing read-only Workspace CodeBlock and an outer scrolling surface", () => {
  const { container } = render(<WorkspaceSourceViewport {...defaults} />)
  expect(viewport(container).className).toContain("overflow-auto")
  expect(container.querySelector("pre")?.dataset.presentation).toBe("workspace")
  expect(container.querySelector("pre")?.className).toBe("h-full")
  expect(container.querySelector("textarea, [contenteditable='true']")).toBeNull()
})

it("restores both axes independently for file changes, project changes and refresh", () => {
  const view = render(<WorkspaceSourceViewport {...defaults} />)
  scroll(viewport(view.container), 240, 32)
  view.rerender(<WorkspaceSourceViewport {...defaults} filePath="src/facets/CounterDataFacet.sol" source="contract CounterDataFacet {}" />)
  expect(viewport(view.container).scrollTop).toBe(0)
  scroll(viewport(view.container), 120, 8)
  view.rerender(<WorkspaceSourceViewport {...defaults} />)
  expect([viewport(view.container).scrollTop, viewport(view.container).scrollLeft]).toEqual([240, 32])
  view.rerender(<WorkspaceSourceViewport {...defaults} projectId="second" />)
  expect(viewport(view.container).scrollTop).toBe(0)
  scroll(viewport(view.container), 80, 2)
  view.rerender(<WorkspaceSourceViewport {...defaults} />)
  expect(viewport(view.container).scrollTop).toBe(240)
  view.unmount()
  const refreshed = render(<WorkspaceSourceViewport {...defaults} />)
  expect([viewport(refreshed.container).scrollTop, viewport(refreshed.container).scrollLeft]).toEqual([240, 32])
})

it.each(["// Loading source…", "// Loading source...", "// Source unavailable. Try reloading the project."])("does not clobber saved scroll while showing %s", (placeholder) => {
  const view = render(<WorkspaceSourceViewport {...defaults} />)
  scroll(viewport(view.container), 360, 16)
  view.unmount()
  const refreshed = render(<WorkspaceSourceViewport {...defaults} source={placeholder} />)
  expect(viewport(refreshed.container).scrollTop).toBe(0)
  scroll(viewport(refreshed.container), 0, 0)
  refreshed.unmount()
  const loaded = render(<WorkspaceSourceViewport {...defaults} source="// Loading source…" />)
  loaded.rerender(<WorkspaceSourceViewport {...defaults} />)
  expect([viewport(loaded.container).scrollTop, viewport(loaded.container).scrollLeft]).toEqual([360, 16])
})

it("restores after Project mode hides the source and a pending file finishes loading", async () => {
  const view = render(<section><WorkspaceSourceViewport {...defaults} /></section>)
  scroll(viewport(view.container), 200, 24)
  view.rerender(<section hidden><WorkspaceSourceViewport {...defaults} source="// Loading source…" /></section>)
  scroll(viewport(view.container), 0, 0)
  view.rerender(<section hidden><WorkspaceSourceViewport {...defaults} /></section>)
  view.rerender(<section><WorkspaceSourceViewport {...defaults} /></section>)
  await waitFor(() => expect([viewport(view.container).scrollTop, viewport(view.container).scrollLeft]).toEqual([200, 24]))
})

it("continues to restore live file positions when storage is blocked", () => {
  vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw new Error("Storage blocked") })
  const view = render(<WorkspaceSourceViewport {...defaults} />)
  scroll(viewport(view.container), 140, 11)
  view.rerender(<WorkspaceSourceViewport {...defaults} filePath="scripts/deploy.ts" source="export default {}" language="typescript" />)
  scroll(viewport(view.container), 40, 3)
  view.rerender(<WorkspaceSourceViewport {...defaults} />)
  expect([viewport(view.container).scrollTop, viewport(view.container).scrollLeft]).toEqual([140, 11])
})

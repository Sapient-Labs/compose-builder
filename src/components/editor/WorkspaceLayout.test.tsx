import { useState } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { WorkspaceLayout } from "./WorkspaceLayout"

vi.mock("./DiamondSetupPanel", () => ({ DiamondSetupPanel: ({ onReview }: { onReview: () => void }) => <button onClick={onReview}>Review project</button> }))
vi.mock("@/components/graph/DiamondGraph", () => ({ DiamondGraph: ({ onSourceSelect }: { onSourceSelect: (path: string) => void }) => <button onClick={() => onSourceSelect("src/Diamond.sol")}>Graph diamond</button> }))
beforeEach(() => { window.history.replaceState(null, "", "#/"); window.sessionStorage.clear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const renderWorkspace = (onSourceSelect = vi.fn()) => {
  const onModeChange = vi.fn()
  function TestWrapper() {
    const [mode, setMode] = useState<"builder" | "project">("builder")
    return <WorkspaceLayout mode={mode} onModeChange={(next) => { onModeChange(next); setMode(next) }} toolbar={<span>Project toolbar</span>} explorer={(onSelect) => <button onClick={onSelect}>Diamond.sol</button>} source={<pre>contract Diamond</pre>} projectData={<div className="workspace-pane-header">Selectors / Storage</div>} gasEstimate={<div className="workspace-pane-header">Gas estimate</div>} filePath="src/Diamond.sol" onSourceSelect={onSourceSelect} />
  }
  const utils = render(<TestWrapper />)
  return { ...utils, onModeChange }
}

it("uses Builder and Project as primary navigation, with subordinate Configure and Files", () => {
  renderWorkspace()
  expect(screen.getByRole("button", { name: "Builder" }).getAttribute("aria-pressed")).toBe("true")
  expect(screen.getByRole("button", { name: "Project" })).toBeTruthy()
  expect(screen.getByRole("tab", { name: "Configure" })).toBeTruthy()
  expect(screen.getByRole("tab", { name: "Files" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Show file explorer" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
  expect(screen.queryByRole("button", { name: "Review project" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
  expect(screen.getByRole("button", { name: "Review project" })).toBeTruthy()
})

it("Review project switches mode while retaining mounted Builder state and graph", () => {
  const { container, onModeChange } = renderWorkspace()
  const source = container.querySelector("pre")
  source!.parentElement!.scrollTop = 80
  fireEvent.click(screen.getByRole("button", { name: "Review project" }))
  expect(onModeChange).toHaveBeenCalledWith("project")
  expect(screen.queryByRole("region", { name: "Source review" })).toBeNull()
  expect(screen.getByRole("region", { name: "Project selectors and storage" })).toBeTruthy()
  expect(screen.getByRole("region", { name: "Project gas estimate" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Graph diamond" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Builder" }))
  expect(container.querySelector("pre")).toBe(source)
  expect(source!.parentElement!.scrollTop).toBe(80)
  expect(screen.getByRole("button", { name: "Graph diamond" })).toBeTruthy()
})

it("graph source selection switches the subordinate file tab without changing mode", () => {
  const select = vi.fn()
  renderWorkspace(select)
  fireEvent.click(screen.getByRole("button", { name: "Graph diamond" }))
  expect(select).toHaveBeenCalledWith("src/Diamond.sol")
  expect(screen.getByRole("button", { name: "Diamond.sol" })).toBeTruthy()
})

it("dismisses the mobile Builder overlay after review or file selection", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }))
  renderWorkspace()
  fireEvent.click(screen.getByRole("button", { name: "Review project" }))
  fireEvent.click(screen.getByRole("button", { name: "Builder" }))
  expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Files" }), { button: 0, ctrlKey: false })
  fireEvent.click(screen.getByRole("button", { name: "Diamond.sol" }))
  expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy()
})

it("retains the shared header contract for both modes", () => {
  const { container } = renderWorkspace()
  expect(container.querySelectorAll(".workspace-pane-header")).toHaveLength(5)
  expect(container.querySelector(".workspace-review .workspace-pane-header")).toBeTruthy()
  expect(container.querySelector(".workspace-graph .workspace-pane-header")).toBeTruthy()
})

it.each([true, false])("removes the Project sidebar track and restores Builder sidebar open=%s", (sidebarOpen) => {
  const { container } = renderWorkspace()
  const panes = container.querySelector(".workspace-panes")!
  if (!sidebarOpen) fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))

  expect(panes.getAttribute("data-mode")).toBe("builder")
  expect(panes.getAttribute("data-sidebar-open")).toBe(String(sidebarOpen))
  if (sidebarOpen) {
    expect(container.querySelector("#workspace-sidebar")).toBeTruthy()
  } else {
    expect(container.querySelector(".workspace-sidebar-strip")).toBeTruthy()
  }

  fireEvent.click(screen.getByRole("button", { name: "Project" }))
  expect(panes.getAttribute("data-mode")).toBe("project")
  expect(panes.getAttribute("data-sidebar-open")).toBe("false")
  expect(container.querySelector("#workspace-sidebar")).toBeNull()
  expect(container.querySelector(".workspace-sidebar-strip")).toBeNull()
  expect(screen.getByRole("region", { name: "Project gas estimate" }).classList.contains("workspace-graph")).toBe(true)

  fireEvent.click(screen.getByRole("button", { name: "Builder" }))
  expect(panes.getAttribute("data-mode")).toBe("builder")
  expect(panes.getAttribute("data-sidebar-open")).toBe(String(sidebarOpen))
  if (sidebarOpen) {
    expect(container.querySelector("#workspace-sidebar")).toBeTruthy()
  } else {
    expect(container.querySelector(".workspace-sidebar-strip")).toBeTruthy()
  }
  expect(screen.getByRole("region", { name: "Composition preview" }).classList.contains("workspace-graph")).toBe(true)
})

it("toggles the code pane from the pane header and fills the graph", () => {
  const { container } = renderWorkspace()
  fireEvent.click(screen.getByRole("button", { name: "Close code pane" }))
  expect(screen.queryByRole("region", { name: "Source review" })).toBeNull()
  expect(screen.getByRole("region", { name: "Composition preview" })).toBeTruthy()
  expect(container.querySelector(".workspace-splitter")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Show code pane" }))
  expect(screen.getByRole("region", { name: "Source review" })).toBeTruthy()
})

it("toggles the graph pane from the pane header and fills the code", () => {
  const { container } = renderWorkspace()
  fireEvent.click(screen.getByRole("button", { name: "Close graph pane" }))
  expect(screen.queryByRole("region", { name: "Composition preview" })).toBeNull()
  expect(screen.getByRole("region", { name: "Source review" })).toBeTruthy()
  expect(container.querySelector(".workspace-splitter")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Show graph pane" }))
  expect(screen.getByRole("region", { name: "Composition preview" })).toBeTruthy()
})

it("does not offer a close button for the last open pane", () => {
  renderWorkspace()
  expect(screen.getByRole("button", { name: "Close code pane" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Close graph pane" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Close code pane" }))
  expect(screen.queryByRole("button", { name: "Close graph pane" })).toBeNull()
  expect(screen.getByRole("button", { name: "Show code pane" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Show code pane" }))
  expect(screen.getByRole("button", { name: "Close code pane" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Close graph pane" })).toBeTruthy()
})

it("closes a pane from its header button", () => {
  const { container } = renderWorkspace()
  fireEvent.click(container.querySelector('[aria-label="Close code pane"]')!)
  expect(screen.queryByRole("region", { name: "Source review" })).toBeNull()
  expect(container.querySelector('[aria-label="Close code pane"]')).toBeNull()
})

it("resizes the graph pane by dragging the splitter", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(min-width: 1000px)" }))
  const { container } = renderWorkspace()
  const main = container.querySelector(".workspace-main")!
  const splitter = container.querySelector(".workspace-splitter")!
  Object.defineProperty(main, "clientWidth", { value: 1000 })
  Object.defineProperty(splitter, "offsetWidth", { value: 12 })
  const graph = container.querySelector<HTMLElement>('[aria-label="Composition preview"]')!
  expect(graph.style.width).toBe("35%")
  fireEvent.pointerDown(splitter, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(splitter, { clientX: 150, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(splitter, { clientX: 150, clientY: 100, pointerId: 1 })
  expect(graph.style.width).toBe("30%")
})

it("resizes the graph pane with keyboard arrows", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(min-width: 1000px)" }))
  const { container } = renderWorkspace()
  const splitter = container.querySelector(".workspace-splitter")!
  const graph = container.querySelector<HTMLElement>('[aria-label="Composition preview"]')!
  fireEvent.keyDown(splitter, { key: "ArrowRight" })
  expect(graph.style.width).toBe("32%")
  fireEvent.keyDown(splitter, { key: "Home" })
  expect(graph.style.width).toBe("20%")
})

it("restores pane toggles and split ratio from session storage", () => {
  window.sessionStorage.setItem("compose-launchpad:workspace:pane-layout", JSON.stringify({ codeOpen: false, graphOpen: true, splitRatio: 0.5 }))
  const { container } = renderWorkspace()
  expect(screen.queryByRole("region", { name: "Source review" })).toBeNull()
  expect(screen.getByRole("region", { name: "Composition preview" })).toBeTruthy()
  expect(container.querySelector<HTMLElement>('[aria-label="Composition preview"]')!.style.flex).toBe("1 1 0px")
  window.sessionStorage.clear()
})

it("restores the split ratio from session storage", () => {
  window.sessionStorage.setItem("compose-launchpad:workspace:pane-layout", JSON.stringify({ codeOpen: true, graphOpen: true, splitRatio: 0.5 }))
  const { container } = renderWorkspace()
  expect(container.querySelector<HTMLElement>('[aria-label="Composition preview"]')!.style.width).toBe("50%")
  window.sessionStorage.clear()
})

it("stacks panes vertically and resizes by height on mobile", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }))
  const { container } = renderWorkspace()
  const main = container.querySelector(".workspace-main")!
  const splitter = container.querySelector(".workspace-splitter")!
  expect(main.getAttribute("data-orientation")).toBe("column")
  expect(splitter.getAttribute("aria-orientation")).toBe("horizontal")
  Object.defineProperty(main, "clientHeight", { value: 800 })
  Object.defineProperty(splitter, "offsetHeight", { value: 12 })
  const graph = container.querySelector<HTMLElement>('[aria-label="Composition preview"]')!
  expect(graph.style.height).toBe("35%")
  fireEvent.pointerDown(splitter, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(splitter, { clientX: 100, clientY: 160, pointerId: 1 })
  fireEvent.pointerUp(splitter, { clientX: 100, clientY: 160, pointerId: 1 })
  expect(graph.style.height).toBe("27%")
})

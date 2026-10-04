import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { WorkspaceLayout } from "./WorkspaceLayout"

vi.mock("./DiamondSetupPanel", () => ({ DiamondSetupPanel: ({ onReview }: { onReview: () => void }) => <button onClick={onReview}>Review project</button> }))
vi.mock("@/components/graph/DiamondGraph", () => ({ DiamondGraph: ({ onSourceSelect }: { onSourceSelect: (path: string) => void }) => <button onClick={() => onSourceSelect("src/Diamond.sol")}>Graph diamond</button> }))
beforeEach(() => window.history.replaceState(null, "", "#/workspace"))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const renderWorkspace = (onSourceSelect = vi.fn()) => render(<WorkspaceLayout toolbar={<span>Project toolbar</span>} explorer={(onSelect) => <button onClick={onSelect}>Diamond.sol</button>} source={<pre>contract Diamond</pre>} projectData={<div className="workspace-pane-header">Selectors / Storage</div>} gasEstimate={<div className="workspace-pane-header">Gas estimate</div>} filePath="src/Diamond.sol" onSourceSelect={onSourceSelect} />)

it("uses Builder and Project as primary navigation, with subordinate Configure and Files", () => {
  renderWorkspace()
  expect(screen.getByRole("button", { name: "Builder" }).getAttribute("aria-pressed")).toBe("true")
  expect(screen.getByRole("button", { name: "Project" })).toBeTruthy()
  expect(screen.getByRole("tab", { name: "Configure" })).toBeTruthy()
  expect(screen.getByRole("tab", { name: "Files" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Show file explorer" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Collapse builder sidebar" }))
  expect(screen.queryByRole("button", { name: "Review project" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Expand builder sidebar" }))
  expect(screen.getByRole("button", { name: "Review project" })).toBeTruthy()
})

it("Review project switches mode while retaining mounted Builder state and graph", () => {
  const { container } = renderWorkspace()
  const source = container.querySelector("pre")
  source!.parentElement!.scrollTop = 80
  fireEvent.click(screen.getByRole("button", { name: "Review project" }))
  expect(window.location.hash).toBe("#/workspace/project")
  expect(screen.queryByRole("region", { name: "Source review" })).toBeNull()
  expect(screen.getByRole("region", { name: "Project selectors and storage" })).toBeTruthy()
  expect(screen.getByRole("region", { name: "Project gas estimate" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Graph diamond" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Builder" }))
  expect(container.querySelector("pre")).toBe(source)
  expect(source!.parentElement!.scrollTop).toBe(80)
  expect(screen.getByRole("button", { name: "Graph diamond" })).toBeTruthy()
})

it("direct Project refresh and browser Back choose the correct mode", async () => {
  window.history.replaceState(null, "", "#/workspace/project")
  const { container } = renderWorkspace()
  expect(screen.getByRole("button", { name: "Project" }).getAttribute("aria-pressed")).toBe("true")
  expect(container.querySelector(".workspace-panes")?.getAttribute("data-sidebar-open")).toBe("false")
  expect(container.querySelector<HTMLElement>("#workspace-sidebar")?.hidden).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "Builder" }))
  expect(screen.getByRole("button", { name: "Graph diamond" })).toBeTruthy()
  await act(async () => { window.history.back(); await new Promise((resolve) => setTimeout(resolve, 20)) })
  await waitFor(() => expect(screen.getByRole("button", { name: "Project" }).getAttribute("aria-pressed")).toBe("true"))
})

it("graph source selection switches the subordinate file tab without changing mode", () => {
  const select = vi.fn()
  renderWorkspace(select)
  fireEvent.click(screen.getByRole("button", { name: "Graph diamond" }))
  expect(select).toHaveBeenCalledWith("src/Diamond.sol")
  expect(screen.getByRole("button", { name: "Diamond.sol" })).toBeTruthy()
  expect(window.location.hash).toBe("#/workspace")
})

it("dismisses the mobile Builder overlay after review or file selection", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }))
  renderWorkspace()
  fireEvent.click(screen.getByRole("button", { name: "Review project" }))
  fireEvent.click(screen.getByRole("button", { name: "Builder" }))
  expect(screen.getByRole("button", { name: "Expand builder sidebar" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Expand builder sidebar" }))
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Files" }), { button: 0, ctrlKey: false })
  fireEvent.click(screen.getByRole("button", { name: "Diamond.sol" }))
  expect(screen.getByRole("button", { name: "Expand builder sidebar" })).toBeTruthy()
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
  const sidebar = container.querySelector<HTMLElement>("#workspace-sidebar")!
  if (!sidebarOpen) fireEvent.click(screen.getByRole("button", { name: "Collapse builder sidebar" }))

  expect(panes.getAttribute("data-mode")).toBe("builder")
  expect(panes.getAttribute("data-sidebar-open")).toBe(String(sidebarOpen))
  expect(sidebar.hidden).toBe(!sidebarOpen)

  fireEvent.click(screen.getByRole("button", { name: "Project" }))
  expect(panes.getAttribute("data-mode")).toBe("project")
  expect(panes.getAttribute("data-sidebar-open")).toBe("false")
  expect(sidebar.hidden).toBe(true)
  expect(screen.getByRole("region", { name: "Project gas estimate" }).classList.contains("workspace-graph")).toBe(true)

  fireEvent.click(screen.getByRole("button", { name: "Builder" }))
  expect(panes.getAttribute("data-mode")).toBe("builder")
  expect(panes.getAttribute("data-sidebar-open")).toBe(String(sidebarOpen))
  expect(sidebar.hidden).toBe(!sidebarOpen)
  expect(screen.getByRole("region", { name: "Composition preview" }).classList.contains("workspace-graph")).toBe(true)
})

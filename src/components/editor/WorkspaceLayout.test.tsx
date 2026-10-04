import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { WorkspaceLayout } from "./WorkspaceLayout"

vi.mock("./DiamondSetupPanel", () => ({ DiamondSetupPanel: ({ onReview }: { onReview: () => void }) => <button onClick={onReview}>Generate project</button> }))
vi.mock("@/components/graph/DiamondGraph", () => ({ DiamondGraph: ({ enableWebGLFallback }: { enableWebGLFallback: boolean }) => <div>Graph fallback {String(enableWebGLFallback)}</div> }))
afterEach(cleanup)

const renderWorkspace = () => render(<WorkspaceLayout toolbar={<span>Project toolbar</span>} explorer={(onSelect) => <button onClick={onSelect}>Diamond.sol</button>} source={<pre>contract Diamond</pre>} inspection={<p>Compiler diagnostics</p>} filePath="src/Diamond.sol" validationIcon={<span>Compiled</span>} />)

it("shows source and graph simultaneously, with a reversible sidebar", () => {
  renderWorkspace()
  expect(screen.getByText("contract Diamond")).toBeTruthy()
  expect(screen.getByText("Graph fallback true")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Collapse workspace sidebar" }))
  expect(screen.queryByRole("button", { name: "Generate project" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Show file explorer" }))
  expect(screen.getByRole("button", { name: "Diamond.sol" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Show configuration" }))
  expect(screen.getByRole("button", { name: "Generate project" })).toBeTruthy()
})

it("opens generated files and code when reviewing, without hiding the graph", () => {
  renderWorkspace()
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Inspect/ }), { button: 0, ctrlKey: false })
  expect(screen.getByText("Compiler diagnostics")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Generate project" }))
  expect(screen.getByText("contract Diamond")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Diamond.sol" })).toBeTruthy()
  expect(screen.getByText("Graph fallback true")).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Code" }))
})

it("dismisses the mobile overlay after reviewing or selecting a file", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }))
  renderWorkspace()
  fireEvent.click(screen.getByRole("button", { name: "Generate project" }))
  expect(screen.getByRole("button", { name: "Expand workspace sidebar" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Show file explorer" }))
  fireEvent.click(screen.getByRole("button", { name: "Diamond.sol" }))
  expect(screen.getByRole("button", { name: "Expand workspace sidebar" })).toBeTruthy()
  vi.unstubAllGlobals()
})

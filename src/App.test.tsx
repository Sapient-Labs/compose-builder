import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import App from "./App"
import { useLaunchpadStore } from "@/lib/state/store"

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }))
vi.mock("@/components/editor/EditorLayout", () => ({ EditorLayout: () => <div>Original editor</div> }))
vi.mock("@/components/editor/EditorSidebar", () => ({ EditorSidebar: () => <div>Original sidebar</div> }))
vi.mock("@/components/editor/ContinueLocallyDialog", () => ({ ContinueLocallyDialog: () => <button>Continue locally</button> }))
vi.mock("@/components/editor/PreviewArea", () => ({ PreviewArea: ({ presentation }: { presentation: string }) => <div>{presentation} presentation</div> }))

beforeEach(() => {
  window.history.replaceState(null, "", "/")
  useLaunchpadStore.setState({ catalog: { globals: {}, features: {} }, isLoading: false, error: null })
})
afterEach(cleanup)

it("keeps the original editor at the default route and handles back/forward hash changes", () => {
  const config = useLaunchpadStore.getState().activeProject?.config
  render(<App />)
  expect(screen.getByText("Original editor")).toBeTruthy()
  expect(screen.getByText("Original sidebar")).toBeTruthy()
  expect(screen.getByRole("link", { name: "Workspace" }).getAttribute("href")).toBe("#/workspace")
  act(() => { window.history.replaceState(null, "", "#/workspace"); window.dispatchEvent(new HashChangeEvent("hashchange")) })
  expect(screen.getByText("workspace presentation")).toBeTruthy()
  expect(screen.queryByText("Original sidebar")).toBeNull()
  act(() => { window.history.replaceState(null, "", "#/"); window.dispatchEvent(new HashChangeEvent("hashchange")) })
  expect(screen.getByText("Original editor")).toBeTruthy()
  expect(useLaunchpadStore.getState().activeProject?.config).toBe(config)
})

it("supports direct workspace links", () => {
  window.history.replaceState(null, "", "#/workspace")
  render(<App />)
  expect(screen.getByText("workspace presentation")).toBeTruthy()
})

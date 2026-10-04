import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import App from "./App"
import { useLaunchpadStore } from "@/lib/state/store"

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }))
vi.mock("@/lib/compose-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/compose-core")>()
  return { ...actual, loadBasesCatalog: vi.fn().mockRejectedValue(new Error("Catalog unavailable")) }
})
vi.mock("@/components/editor/PreviewArea", () => ({ PreviewArea: () => <div>Workspace preview</div> }))
vi.mock("@/components/editor/ContinueLocallyDialog", () => ({ ContinueLocallyDialog: () => <button>Continue locally</button> }))

beforeEach(() => {
  useLaunchpadStore.setState({ catalog: { globals: {}, features: {} }, isLoading: false, error: null })
})
afterEach(cleanup)

it("renders the workspace preview once the catalog is available", () => {
  render(<App />)
  expect(screen.getByText("Workspace preview")).toBeTruthy()
})

it("shows a loading state while the catalog is unavailable", () => {
  useLaunchpadStore.setState({ catalog: null, isLoading: true })
  render(<App />)
  expect(screen.getByText("Loading catalog...")).toBeTruthy()
  expect(screen.queryByText("Workspace preview")).toBeNull()
})

it("shows an error state when the catalog fails to load", async () => {
  useLaunchpadStore.setState({ catalog: null, isLoading: false, error: null })
  render(<App />)
  expect(await screen.findByText("Catalog unavailable")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy()
})

it("exposes documentation and theme controls in the toolbar", () => {
  render(<App />)
  expect(screen.getByRole("link", { name: "Documentation" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Continue locally" })).toBeTruthy()
})

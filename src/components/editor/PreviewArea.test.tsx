import { readFile } from "node:fs/promises"
import path from "node:path"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { PreviewArea } from "./PreviewArea"
import { useLaunchpadStore } from "@/lib/state/store"
import { loadBasesCatalog } from "@/lib/compose-core"
import { compileDiamond } from "@/lib/compose-core/compiler"

vi.mock("@/components/ui/code-block", () => ({ CodeBlock: ({ code }: { code: string }) => <pre data-testid="source">{code}</pre> }))
vi.mock("@/components/graph/DiamondGraph", () => ({ DiamondGraph: () => <div>Composition graph</div> }))
vi.mock("@/lib/compose-core/compiler", () => ({ compileDiamond: vi.fn(async () => ({ diagnostics: [], validation: { ok: true, messages: [], selectors: [], storage: [], collisionCount: 0 } })) }))

const localFetch = async (url: string | URL | Request) => {
  const name = String(url).replace(/^\//, "")
  const content = await readFile(path.resolve("public", name), "utf8")
  return { ok: true, text: async () => content, json: async () => JSON.parse(content) } as Response
}

beforeEach(async () => {
  vi.stubGlobal("fetch", vi.fn(localFetch))
  useLaunchpadStore.getState().reset()
  useLaunchpadStore.getState().setCatalog(await loadBasesCatalog())
  useLaunchpadStore.getState().setConfig({ baseKey: "counter" })
  vi.mocked(compileDiamond).mockClear()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("uses the original source/compiler pipeline and opens actual selected facet files", async () => {
  render(<PreviewArea presentation="workspace" />)
  await screen.findByText("Compiled")
  expect(compileDiamond).toHaveBeenCalled()
  expect(screen.getByTestId("source").textContent).toContain("contract Diamond")
  fireEvent.click(screen.getByRole("button", { name: "Generate project" }))
  const file = await screen.findByRole("button", { name: "CounterDataFacet.sol" })
  fireEvent.click(file)
  expect(screen.getByTestId("source").textContent).toContain("contract CounterDataFacet")
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Inspect/ }), { button: 0, ctrlKey: false })
  expect(screen.getByText("Project passed local checks")).toBeTruthy()
  expect(screen.getByText("Composition graph")).toBeTruthy()
})

it("updates generated source immediately and ignores obsolete file loads", async () => {
  let releaseOld: (response: Response) => void = () => {}
  const pending = new Promise<Response>((resolve) => { releaseOld = resolve })
  const fetcher = vi.mocked(fetch)
  let firstManifest = true
  fetcher.mockImplementation((url) => {
    if (String(url).includes("compose-sources.json") && firstManifest) { firstManifest = false; return pending }
    return localFetch(url)
  })
  render(<PreviewArea presentation="workspace" />)
  await act(async () => useLaunchpadStore.getState().setConfig({ baseKey: "erc-20" }))
  expect(screen.getByTestId("source").textContent).toContain("ERC20")
  fireEvent.click(screen.getByRole("button", { name: "Show file explorer" }))
  await waitFor(() => expect(screen.queryAllByRole("button", { name: /ERC20.*Facet.sol/ }).length).toBeGreaterThan(0))
  await act(async () => { releaseOld(await localFetch("/compiler/compose-sources.json")); await new Promise((resolve) => setTimeout(resolve, 20)) })
  expect(screen.queryByRole("button", { name: "CounterDataFacet.sol" })).toBeNull()
  expect(screen.getByTestId("source").textContent).toContain("ERC20")
})

it("keeps framework source options functional", async () => {
  render(<PreviewArea presentation="workspace" />)
  await screen.findByText("Compiled")
  await act(async () => useLaunchpadStore.getState().setConfig({ framework: "hardhat", toolbox: "viem" }))
  fireEvent.click(screen.getByRole("button", { name: "Show file explorer" }))
  fireEvent.click(await screen.findByRole("button", { name: "deploy.ts" }))
  expect(screen.getByTestId("source").textContent).toContain('import { viem } from "hardhat"')
  await act(async () => useLaunchpadStore.getState().setConfig({ toolbox: "ethers" }))
  expect(screen.getByTestId("source").textContent).toContain('import { ethers } from "hardhat"')
})

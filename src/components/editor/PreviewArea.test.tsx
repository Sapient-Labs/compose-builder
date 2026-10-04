HTMLElement.prototype.scrollIntoView = vi.fn()
import { readFile } from "node:fs/promises"
import path from "node:path"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { PreviewArea } from "./PreviewArea"
import { useLaunchpadStore } from "@/lib/state/store"
import { buildCliCommand, loadBasesCatalog } from "@/lib/compose-core"
import { compileDiamond } from "@/lib/compose-core/compiler"

vi.mock("@/components/ui/code-block", () => ({ CodeBlock: ({ code, language }: { code: string; language?: string }) => <pre data-testid={language === "bash" ? "cli-command" : "source"}>{code}</pre> }))
vi.mock("@/components/graph/DiamondGraph", () => ({ DiamondGraph: ({ onSourceSelect }: { onSourceSelect?: (path: string) => void }) => <div>Composition graph<button onClick={() => onSourceSelect?.("src/Diamond.sol")}>Graph diamond</button><button onClick={() => onSourceSelect?.("src/facets/CounterDataFacet.sol")}>Graph counter data</button><button onClick={() => onSourceSelect?.("src/facets/CounterIncrementFacet.sol")}>Graph counter increment</button></div> }))
vi.mock("@/lib/compose-core/compiler", () => ({ compileDiamond: vi.fn(async () => ({ diagnostics: [], validation: { ok: true, messages: [], selectors: [], storage: [], collisionCount: 0 } })) }))

const localFetch = async (url: string | URL | Request) => {
  const name = String(url).replace(/^\//, "")
  const content = await readFile(path.resolve("public", name), "utf8")
  return { ok: true, text: async () => content, json: async () => JSON.parse(content) } as Response
}

beforeEach(async () => {
  window.history.replaceState(null, "", "#/workspace")
  window.sessionStorage.clear()
  vi.stubGlobal("fetch", vi.fn(localFetch))
  useLaunchpadStore.getState().reset()
  useLaunchpadStore.getState().setCatalog(await loadBasesCatalog())
  useLaunchpadStore.getState().setConfig({ baseKey: "counter" })
  vi.mocked(compileDiamond).mockReset().mockResolvedValue({ diagnostics: [], validation: { ok: true, messages: [], selectors: [], storage: [], collisionCount: 0 } } as Awaited<ReturnType<typeof compileDiamond>>)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("uses the original source/compiler pipeline and opens actual selected facet files", async () => {
  render(<PreviewArea presentation="workspace" />)
  await screen.findByText("Compiled")
  expect(compileDiamond).toHaveBeenCalled()
  expect(screen.getByTestId("source").textContent).toContain("contract Diamond")
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Files" }), { button: 0, ctrlKey: false })
  const file = await screen.findByRole("button", { name: "CounterDataFacet.sol" })
  fireEvent.click(file)
  await waitFor(() => expect(screen.getByTestId("source").textContent).toContain("contract CounterDataFacet"))
  fireEvent.click(screen.getByRole("button", { name: "Project" }))
  expect(screen.getByRole("region", { name: "Project selectors and storage" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Graph diamond" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Builder" }))
  expect(screen.getByTestId("source").textContent).toContain("contract CounterDataFacet")
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
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Files" }), { button: 0, ctrlKey: false })
  await waitFor(() => expect(screen.queryAllByRole("button", { name: /ERC20.*Facet.sol/ }).length).toBeGreaterThan(0))
  await act(async () => { releaseOld(await localFetch("/compiler/compose-sources.json")); await new Promise((resolve) => setTimeout(resolve, 20)) })
  expect(screen.queryByRole("button", { name: "CounterDataFacet.sol" })).toBeNull()
  expect(screen.getByTestId("source").textContent).toContain("ERC20")
})

it("keeps framework source options functional", async () => {
  render(<PreviewArea presentation="workspace" />)
  await screen.findByText("Compiled")
  await act(async () => useLaunchpadStore.getState().setConfig({ framework: "hardhat", toolbox: "viem" }))
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Files" }), { button: 0, ctrlKey: false })
  fireEvent.click(await screen.findByRole("button", { name: "deploy.ts" }))
  expect(screen.getByTestId("source").textContent).toContain('import { viem } from "hardhat"')
  await act(async () => useLaunchpadStore.getState().setConfig({ toolbox: "ethers" }))
  expect(screen.getByTestId("source").textContent).toContain('import { ethers } from "hardhat"')
})

it("drives current generated source and compiler inputs from the new inline form", async () => {
  render(<PreviewArea presentation="workspace" />)
  await screen.findByText("Compiled")
  fireEvent.click(screen.getByRole("checkbox", { name: "CounterResetFacet" }))
  await waitFor(() => expect(vi.mocked(compileDiamond).mock.calls.at(-1)?.[1]?.some((x) => x.name === "CounterResetFacet")).toBe(true))
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Base" }), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: "Fungible Token · ERC-20" }))
  expect(screen.getByTestId("source").textContent).toContain("ERC20")
  expect(useLaunchpadStore.getState().activeProject!.config.selectedExtensions).toEqual([])
  await waitFor(() => {
    const last = vi.mocked(compileDiamond).mock.calls.at(-1)
    expect(last?.[0]).toContain("ERC20")
    expect(last?.[1]?.some((x) => x.name === "CounterResetFacet")).toBe(false)
  })
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Ownership" }), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: "Owner" }))
  expect(screen.getByTestId("source").textContent).toContain("OwnerDataMod.setContractOwner")
})

it("invalidates inspection while changed facets compile even when Diamond.sol is unchanged", async () => {
  render(<PreviewArea presentation="workspace" />)
  await screen.findByText("Compiled")
  const source = screen.getByTestId("source").textContent
  vi.mocked(compileDiamond).mockImplementationOnce(() => new Promise(() => {}))
  fireEvent.click(screen.getByRole("checkbox", { name: "CounterResetFacet" }))
  expect(screen.getByTestId("source").textContent).toBe(source)
  expect(screen.getByText("Compiling")).toBeTruthy()
  expect(screen.queryByText("Compiled")).toBeNull()
})


it("graph source selection opens Code and selects the exact explorer file, including Diamond", async () => {
  render(<PreviewArea presentation="workspace" />)
  await screen.findByText("Compiled")
  fireEvent.click(screen.getByRole("button", { name: "Graph counter data" }))
  await waitFor(() => expect(screen.getByTestId("source").textContent).toContain("contract CounterDataFacet"))
  expect(screen.getByRole("button", { name: "CounterDataFacet.sol" }).getAttribute("aria-current")).toBe("page")
  fireEvent.click(screen.getByRole("button", { name: "Graph diamond" }))
  expect(screen.getByTestId("source").textContent).toContain("contract Diamond")
  expect(screen.getByRole("button", { name: "Diamond.sol" }).getAttribute("aria-current")).toBe("page")
})

it("a late source load preserves the most recent graph or file selection", async () => {
  let release: (response: Response) => void = () => {}
  const pending = new Promise<Response>((resolve) => { release = resolve })
  vi.mocked(fetch).mockImplementation((url) => String(url).includes("compose-sources.json") ? pending : localFetch(url))
  render(<PreviewArea presentation="workspace" />)
  fireEvent.click(screen.getByRole("button", { name: "Graph counter data" }))
  expect(screen.getByTestId("source").textContent).toContain("Loading source")
  expect(screen.getByRole("button", { name: "CounterDataFacet.sol" }).getAttribute("aria-current")).toBe("page")
  fireEvent.click(screen.getByRole("button", { name: "Graph counter increment" }))
  await act(async () => { release(await localFetch("/compiler/compose-sources.json")) })
  await waitFor(() => expect(screen.getByTestId("source").textContent).toContain("contract CounterIncrementFacet"))
  expect(screen.getByRole("button", { name: "CounterIncrementFacet.sol" }).getAttribute("aria-current")).toBe("page")
  fireEvent.click(screen.getByRole("button", { name: "Graph counter data" }))
  await waitFor(() => expect(screen.getByTestId("source").textContent).toContain("contract CounterDataFacet"))
  fireEvent.click(screen.getByRole("button", { name: "Diamond.sol" }))
  expect(screen.getByTestId("source").textContent).toContain("contract Diamond")
})

it("failed facet loading does not redirect a newer Diamond selection", async () => {
  let reject: (reason: Error) => void = () => {}
  const pending = new Promise<Response>((_, fail) => { reject = fail })
  vi.mocked(fetch).mockImplementation((url) => String(url).includes("compose-sources.json") ? pending : localFetch(url))
  render(<PreviewArea presentation="workspace" />)
  fireEvent.click(screen.getByRole("button", { name: "Graph counter data" }))
  fireEvent.click(screen.getByRole("button", { name: "Graph diamond" }))
  await act(async () => { reject(new Error("Offline")) })
  expect(screen.getByTestId("source").textContent).toContain("contract Diamond")
  fireEvent.click(screen.getByRole("button", { name: "Graph counter data" }))
  expect(screen.getByTestId("source").textContent).toContain("Source unavailable")
  expect(screen.getByRole("button", { name: "CounterDataFacet.sol" }).getAttribute("aria-current")).toBe("page")
})


it("Review project opens selectors and gas, then Builder keeps the selected source", async () => {
  render(<PreviewArea presentation="workspace" />)
  await screen.findByText("Compiled")
  fireEvent.click(screen.getByRole("button", { name: "Graph counter data" }))
  await waitFor(() => expect(screen.getByTestId("source").textContent).toContain("contract CounterDataFacet"))
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Configure" }), { button: 0, ctrlKey: false })
  fireEvent.click(screen.getByRole("button", { name: "Review project" }))
  expect(window.location.hash).toBe("#/workspace/project")
  expect(screen.getByRole("tab", { name: /Selectors/ })).toBeTruthy()
  expect(screen.getByRole("heading", { name: "Gas estimate" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Builder" }))
  expect(screen.getByTestId("source").textContent).toContain("contract CounterDataFacet")
})

it("Project never displays previous selectors or gas while a changed selection compiles", async () => {
  const oldResult = {
    diagnostics: [],
    validation: { ok: true, messages: [], selectors: [{ selector: "0x12345678", signature: "oldFunction()", facet: "CounterDataFacet", collision: false }], storage: [], collisionCount: 0 },
    gasEstimates: { compilerVersion: "0.8.30", optimizer: { enabled: true, runs: 200 }, evmVersion: "paris", contracts: [{ contract: "Diamond", source: "contracts/Diamond.sol", creation: { totalCost: "424242" as const }, external: {}, internal: {} }] },
  }
  vi.mocked(compileDiamond).mockResolvedValueOnce(oldResult)
  render(<PreviewArea presentation="workspace" />)
  await screen.findByText("Compiled")
  fireEvent.click(screen.getByRole("button", { name: "Review project" }))
  expect(screen.getByText("oldFunction()")).toBeTruthy()
  expect(screen.getByText("424,242 gas")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Builder" }))
  vi.mocked(compileDiamond).mockImplementationOnce(() => new Promise(() => {}))
  fireEvent.click(screen.getByRole("checkbox", { name: "CounterResetFacet" }))
  fireEvent.click(screen.getByRole("button", { name: "Review project" }))
  expect(screen.queryByText("oldFunction()")).toBeNull()
  expect(screen.queryByText("424,242 gas")).toBeNull()
  expect(screen.getByText("Compiling")).toBeTruthy()
  expect(screen.queryByRole("table", { name: "Exported function selectors" })).toBeNull()
})

it("Project command follows current project configuration even while gas recompiles", async () => {
  render(<PreviewArea presentation="workspace" />)
  await screen.findByText("Compiled")
  fireEvent.click(screen.getByRole("button", { name: "Review project" }))
  const command = () => buildCliCommand(useLaunchpadStore.getState().activeProject!.config, useLaunchpadStore.getState().activeProject!.name || "my-diamond")
  expect(screen.getByLabelText("Compose command").textContent).toBe(command())
  vi.mocked(compileDiamond).mockImplementationOnce(() => new Promise(() => {}))
  await act(async () => {
    useLaunchpadStore.getState().updateProject({ name: "My chosen diamond" })
    useLaunchpadStore.getState().setConfig({ framework: "hardhat", toolbox: "viem", selectedLibraries: ["ERC165Facet"], selectedAccess: ["owner"] })
  })
  expect(screen.getByLabelText("Compose command").textContent).toBe(command())
  expect(command()).toContain("--name My-chosen-diamond")
  expect(command()).toContain("--framework hardhat --toolbox viem")
  expect(screen.queryByText("424,242 gas")).toBeNull()
})

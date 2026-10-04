import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { DiamondCompileResult } from "@/lib/compose-core/compiler"
import { GasEstimatePanel, ProjectDataPanel } from "./WorkspaceProjectReview"

const result: DiamondCompileResult = {
  diagnostics: [],
  validation: {
    ok: true,
    messages: [],
    selectors: [{ selector: "0x12345678", signature: "increment()", facet: "CounterFacet", collision: false }],
    storage: [{ label: "compose.counter", constant: "COUNTER_STORAGE_POSITION", facets: ["CounterFacet", "CounterResetFacet"] }],
    collisionCount: 0,
  },
  gasEstimates: {
    compilerVersion: "0.8.30", optimizer: { enabled: true, runs: 200 }, evmVersion: "paris",
    contracts: [{
      contract: "Diamond", source: "contracts/Diamond.sol",
      creation: { codeDepositCost: "420000", executionCost: "infinite", totalCost: "infinite" },
      external: { "version()": "0", "large()": "9007199254740993" }, internal: {},
    }],
  },
}

afterEach(cleanup)

const selectStorage = () => fireEvent.mouseDown(screen.getByRole("tab", { name: /Storage/ }), { button: 0, ctrlKey: false })

describe("Project data panel", () => {
  it("shows the current selectors and source-derived storage without modifying configuration", () => {
    render(<ProjectDataPanel currentCompileResult={result} compiling={false} />)
    expect(screen.getByRole("table", { name: "Exported function selectors" })).toBeTruthy()
    expect(screen.getByText("increment()")).toBeTruthy()
    expect(screen.getByText("0x12345678")).toBeTruthy()
    selectStorage()
    expect(screen.getByRole("table", { name: "Storage slots" })).toBeTruthy()
    expect(screen.getByText("COUNTER_STORAGE_POSITION")).toBeTruthy()
    expect(screen.getByText("CounterFacet, CounterResetFacet")).toBeTruthy()
    expect(screen.getByText(/not a full compiler storage layout/)).toBeTruthy()
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  it("preserves the Storage tab across hidden Project mode and recompilation", () => {
    const view = (hidden: boolean, compiling = false) => <section hidden={hidden}><ProjectDataPanel currentCompileResult={result} compiling={compiling} /></section>
    const { rerender } = render(view(false))
    selectStorage()
    rerender(view(true))
    rerender(view(false, true))
    expect(screen.getByRole("status").textContent).toContain("Compiling project data")
    expect(screen.queryByText("COUNTER_STORAGE_POSITION")).toBeNull()
    rerender(view(false))
    expect(screen.getByRole("tab", { name: /Storage/ }).getAttribute("aria-selected")).toBe("true")
    expect(screen.getByText("COUNTER_STORAGE_POSITION")).toBeTruthy()
  })

  it("shows selector collisions and validation messages", () => {
    const invalid = { ...result, validation: { ...result.validation, ok: false, collisionCount: 1, messages: ["Selector collision: 0x12345678 claimed by two facets."], selectors: [{ ...result.validation.selectors[0], collision: true }] } }
    render(<ProjectDataPanel currentCompileResult={invalid} compiling={false} />)
    expect(screen.getByRole("alert").textContent).toContain("claimed by two facets")
    expect(screen.getByText("collision")).toBeTruthy()
  })

  it("shows compiler failures and hides obsolete data", () => {
    const { rerender } = render(<ProjectDataPanel currentCompileResult={result} compiling={false} currentCompileError="Compiler asset unavailable" />)
    expect(screen.getByRole("alert").textContent).toContain("Compiler asset unavailable")
    expect(screen.queryByText("increment()")).toBeNull()
    rerender(<ProjectDataPanel currentCompileResult={{ ...result, diagnostics: [{ severity: "error", message: "Invalid constructor" }] }} compiling={false} />)
    expect(screen.getByRole("alert").textContent).toContain("Invalid constructor")
    expect(screen.queryByText("increment()")).toBeNull()
  })

  it("distinguishes uncompiled and successfully compiled empty projects", () => {
    const { rerender } = render(<ProjectDataPanel compiling={false} />)
    expect(screen.getByRole("status").textContent).toContain("Compile the project")
    rerender(<ProjectDataPanel currentCompileResult={{ ...result, validation: { ...result.validation, selectors: [], storage: [] } }} compiling={false} />)
    expect(screen.getByText("No selectors available for this project.")).toBeTruthy()
    selectStorage()
    expect(screen.getByText("No storage positions declared in selected facets.")).toBeTruthy()
  })
})

describe("Gas estimate panel", () => {
  it("labels actual compiler estimates and infinite values honestly without losing precision", () => {
    render(<GasEstimatePanel currentCompileResult={result} compiling={false} />)
    expect(screen.getByText("solc 0.8.30 · optimizer 200 runs · EVM paris")).toBeTruthy()
    expect(screen.getByText("420,000 gas")).toBeTruthy()
    expect(screen.getByText("0 gas")).toBeTruthy()
    expect(screen.getByText("9,007,199,254,740,993 gas")).toBeTruthy()
    expect(screen.getAllByText("Not statically estimable")).toHaveLength(2)
    expect(screen.getByText(/Actual deployment and calls require simulation/)).toBeTruthy()
    expect(screen.queryByText(/Total deployment/)).toBeNull()
  })

  it("shows absent estimates as unavailable, never as zero", () => {
    render(<GasEstimatePanel currentCompileResult={{ ...result, gasEstimates: undefined }} compiling={false} />)
    expect(screen.getByRole("status").textContent).toContain("Gas estimates unavailable")
    expect(screen.queryByText("0 gas")).toBeNull()
  })

  it("hides prior estimates immediately while recompiling or after compilation errors", () => {
    const { rerender } = render(<GasEstimatePanel currentCompileResult={result} compiling />)
    expect(screen.getByRole("status").textContent).toContain("Compiling gas estimates")
    expect(screen.queryByText("420,000 gas")).toBeNull()
    rerender(<GasEstimatePanel currentCompileResult={result} currentCompileError="Compilation timed out." compiling={false} />)
    expect(screen.getByRole("alert").textContent).toContain("Compilation timed out.")
    expect(screen.queryByText("420,000 gas")).toBeNull()
    rerender(<GasEstimatePanel currentCompileResult={{ ...result, diagnostics: [{ severity: "error", message: "Bad source" }] }} compiling={false} />)
    expect(screen.getByRole("alert").textContent).toContain("Bad source")
    expect(screen.queryByText("420,000 gas")).toBeNull()
  })
})

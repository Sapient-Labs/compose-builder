import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import solc from "solc"
import { compileDiamond } from "./compiler"

const diamondSource = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
contract Diamond {
  constructor(address[] memory) {}
  function version() external pure returns (uint256) { return 1; }
  fallback() external payable {}
  receive() external payable {}
}`

let compile: (input: string) => string
let postedInput: Record<string, any>
const terminate = vi.fn()

beforeEach(() => {
  compile = (input) => solc.compile(input)
  postedInput = {}
  terminate.mockReset()
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ sources: {} }) })))
  vi.stubGlobal("Worker", class {
    onmessage?: (event: { data: { type: string; output: string } }) => void
    onerror?: () => void
    onmessageerror?: () => void
    terminate = terminate
    postMessage({ input }: { input: string }) {
      postedInput = JSON.parse(input)
      queueMicrotask(() => this.onmessage?.({ data: { type: "compiled", output: compile(input) } }))
    }
  })
})

afterEach(() => vi.unstubAllGlobals())

describe("compiler gas estimates", () => {
  it("requests and preserves actual pinned-solc estimates with their compiler settings", async () => {
    const result = await compileDiamond(diamondSource)
    expect(postedInput.settings.outputSelection["*"]["*"]).toContain("evm.gasEstimates")
    expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([])
    const raw = JSON.parse(solc.compile(JSON.stringify(postedInput))).contracts["contracts/Diamond.sol"].Diamond.evm.gasEstimates
    expect(result.gasEstimates).toEqual({
      compilerVersion: "0.8.30",
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      contracts: [{ contract: "Diamond", source: "contracts/Diamond.sol", creation: raw.creation, external: raw.external, internal: raw.internal ?? {} }],
    })
    expect(result.gasEstimates?.contracts[0].creation?.executionCost).toBe("infinite")
    expect(terminate).toHaveBeenCalledOnce()
  })

  it("includes the exact selected facet and preserves zero and large values without numeric conversion", async () => {
    compile = () => JSON.stringify({ contracts: {
      "contracts/Diamond.sol": { Diamond: { evm: { gasEstimates: { creation: { codeDepositCost: "0", executionCost: "infinite", totalCost: "infinite" } } } } },
      "facets/Selected.sol": {
        Selected: { evm: { gasEstimates: { external: { "version()": "9007199254740993" }, internal: { "helper()": "0" } } } },
        Unselected: { evm: { gasEstimates: { external: { "other()": "123" } } } },
      },
      "Dependency.sol": { Dependency: { evm: { gasEstimates: { external: { "hidden()": "123" } } } } },
    } })
    const result = await compileDiamond(diamondSource, [{ name: "Selected", path: "./facets/Selected.sol", content: "contract Selected {}" }])
    expect(result.gasEstimates?.contracts.map((item) => item.contract)).toEqual(["Diamond", "Selected"])
    expect(result.gasEstimates?.contracts[0].creation?.codeDepositCost).toBe("0")
    expect(result.gasEstimates?.contracts[1]).toEqual({
      contract: "Selected", source: "facets/Selected.sol", creation: undefined,
      external: { "version()": "9007199254740993" }, internal: { "helper()": "0" },
    })
  })

  it("leaves absent or malformed estimates unavailable instead of inventing values", async () => {
    compile = () => JSON.stringify({ contracts: {
      "contracts/Diamond.sol": { Diamond: { evm: { gasEstimates: { creation: { totalCost: -2 }, external: { "a()": "NaN", "b()": 123, "c()": "-5" } } } } },
      "facets/Missing.sol": { OtherContract: { evm: { gasEstimates: { external: { "wrong()": "123" } } } } },
    } })
    const malformed = await compileDiamond(diamondSource, [{ name: "Missing", path: "facets/Missing.sol", content: "contract OtherContract {}" }])
    expect(malformed.gasEstimates).toBeUndefined()
    compile = () => JSON.stringify({ contracts: { "contracts/Diamond.sol": { Diamond: { evm: {} } } } })
    expect((await compileDiamond(diamondSource)).gasEstimates).toBeUndefined()
  })

  it("returns real compiler diagnostics and no estimates after an invalid source", async () => {
    const result = await compileDiamond("pragma solidity 0.8.30; contract Diamond { this is invalid }")
    expect(result.diagnostics.some((item) => item.severity === "error")).toBe(true)
    expect(result.gasEstimates).toBeUndefined()
  })
})

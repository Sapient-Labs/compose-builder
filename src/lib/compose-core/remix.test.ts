import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import solc from "solc"
import { loadBasesCatalog } from "./loader"
import { buildRemixSource, buildRemixUrl } from "./remix"
import type { DiamondConfig } from "@/types/config"

const manifest = JSON.parse(
  readFileSync("public/compiler/compose-sources.json", "utf8"),
) as { sources: Record<string, string>; composePackage: string }

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const { pathname } = new URL(String(input), "https://local.test")
      const content = readFileSync(`public${pathname}`, "utf8")
      return {
        ok: true,
        text: async () => content,
        json: async () => JSON.parse(content),
      }
    }),
  )
}

function compileErrors(source: string) {
  const importPattern = /\bimport\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g
  const closure: Record<string, string> = { "Remix.sol": source }
  const pending = ["Remix.sol"]
  while (pending.length) {
    const name = pending.pop()!
    const content = closure[name] ?? manifest.sources[name]
    if (!content) throw new Error(`Missing source: ${name}`)
    closure[name] = content
    for (const match of content.matchAll(importPattern)) pending.push(match[1])
  }

  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: Object.fromEntries(
          Object.entries(closure).map(([name, content]) => [name, { content }]),
        ),
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "paris",
          outputSelection: { "*": { "*": ["abi"] } },
        },
      }),
    ),
  )

  return (output.errors ?? []).filter(
    (item: { severity: string }) => item.severity === "error",
  )
}

describe("buildRemixSource", () => {
  it("imports package facets and adds a Solidity deployer", async () => {
    stubFetch()
    const catalog = await loadBasesCatalog()
    const config: DiamondConfig = {
      framework: "foundry",
      baseKey: "none",
      selectedLibraries: ["ERC165Facet"],
      selectedExtensions: [],
      selectedAccess: ["owner-two-step"],
      selectedAccessExtensions: ["OwnerTwoStepRenounceFacet"],
    }

    const { source, remappings } = await buildRemixSource(catalog, config)

    expect(source).toContain("contract Diamond")
    expect(source).toContain("contract ComposeDeploy")
    expect(source).toContain(
      'import {OwnerDataFacet} from "@perfect-abstractions/compose/access/Owner/Data/OwnerDataFacet.sol";',
    )
    expect(source).not.toContain("contract OwnerDataFacet")
    expect(source).toContain("new OwnerDataFacet()")
    expect(source).toContain("new Diamond(facets, msg.sender)")
    expect(source).not.toContain("OwnerTwoStepDataMod.sol")
    expect(source).not.toContain("OwnerTwoStepTransferMod.sol")
    expect(source).not.toContain("OwnerTwoStepRenounceMod.sol")
    expect(source).toContain(
      'import "@perfect-abstractions/compose/diamond/DiamondMod.sol" as DiamondMod;',
    )
    expect(compileErrors(source)).toEqual([])
    expect(remappings).toEqual([
      "@perfect-abstractions/compose/=@perfect-abstractions/compose@0.0.6/",
    ])
  })

  it("rejects local template facets", async () => {
    stubFetch()
    const catalog = await loadBasesCatalog()
    const config: DiamondConfig = {
      framework: "foundry",
      baseKey: "counter",
      selectedLibraries: [],
      selectedExtensions: [],
      selectedAccess: [],
      selectedAccessExtensions: [],
    }

    await expect(buildRemixSource(catalog, config)).rejects.toThrow(
      "local template, not a published Compose package",
    )
  })

  it("emits a base64 code and remaps deep link", async () => {
    stubFetch()
    const catalog = await loadBasesCatalog()
    const config: DiamondConfig = {
      framework: "foundry",
      baseKey: "none",
      selectedLibraries: [],
      selectedExtensions: [],
      selectedAccess: ["owner"],
      selectedAccessExtensions: [],
    }

    const project = await buildRemixSource(catalog, config)
    const url = buildRemixUrl(project)
    const parsed = new URL(url)

    expect(url.startsWith("https://app.remix.live/?#code=")).toBe(true)
    expect(url).toContain("&remaps=")
    const encoded = new URLSearchParams(parsed.hash.slice(1))
    expect(atob(encoded.get("code")!)).toContain("contract Diamond")
    expect(atob(encoded.get("remaps")!)).toContain("@perfect-abstractions/compose/")
  })
})

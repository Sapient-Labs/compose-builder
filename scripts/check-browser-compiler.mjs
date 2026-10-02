import { readFile } from "node:fs/promises";
import solc from "solc";

const manifest = JSON.parse(
  await readFile("public/compiler/compose-sources.json", "utf8"),
);
const source = `// SPDX-License-Identifier: MIT
pragma solidity >=0.8.30;
import "@perfect-abstractions/compose/diamond/DiamondMod.sol" as DiamondMod;
import "@perfect-abstractions/compose/token/ERC20/Metadata/ERC20MetadataMod.sol" as ERC20MetadataMod;
import "@perfect-abstractions/compose/access/Owner/Data/OwnerDataMod.sol" as OwnerDataMod;
import "@perfect-abstractions/compose/interfaceDetection/ERC165/ERC165Mod.sol" as ERC165Mod;
import "@perfect-abstractions/compose/interfaces/IERC20.sol";
import "@perfect-abstractions/compose/interfaces/IERC173.sol";

contract Diamond {
    constructor(address[] memory _facets) {
        DiamondMod.addFacets(_facets);
        ERC20MetadataMod.setMetadata({_name: "ExampleToken", _symbol: "EXT", _decimals: 18});
        OwnerDataMod.setContractOwner(msg.sender);
        ERC165Mod.registerInterface(type(IERC20).interfaceId);
        ERC165Mod.registerInterface(type(IERC173).interfaceId);
    }

    fallback() external payable {
        DiamondMod.diamondFallback();
    }

    receive() external payable {}
}`;
const importPattern = /\bimport\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g;
const closure = {};
const pending = ["contracts/Diamond.sol"];
const requested = { "contracts/Diamond.sol": source };
while (pending.length) {
  const sourceName = pending.pop();
  if (closure[sourceName]) continue;
  const content = requested[sourceName] ?? manifest.sources[sourceName];
  if (!content) throw new Error(`Missing source: ${sourceName}`);
  closure[sourceName] = content;
  for (const match of content.matchAll(importPattern)) {
    const specifier = match[1];
    const resolved = specifier.startsWith(".")
      ? new URL(specifier, `https://compose.local/${sourceName}`).pathname.slice(1)
      : specifier;
    pending.push(resolved);
  }
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
        metadata: { bytecodeHash: "ipfs", appendCBOR: true, useLiteralContent: true },
        outputSelection: {
          "*": {
            "": ["ast"],
            "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
          },
        },
      },
    }),
  ),
);
const errors = (output.errors ?? []).filter((item) => item.severity === "error");
if (errors.length) throw new Error(errors.map((item) => item.formattedMessage).join("\n"));
const contract = output.contracts?.["contracts/Diamond.sol"]?.Diamond;
if (!contract) throw new Error("Compiler check did not produce Diamond.");
const constructor = contract.abi.find((item) => item.type === "constructor");
if (!constructor || constructor.inputs?.[0]?.type !== "address[]")
  throw new Error("Compiler check produced the wrong Diamond constructor.");
console.log(`Browser compiler check passed (${Object.keys(closure).length} source units).`);

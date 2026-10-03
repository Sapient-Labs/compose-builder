import { keccak256 } from "viem";
import type { Hex } from "viem";

export type CompilerDiagnostic = {
  severity: "error" | "warning" | "info";
  message: string;
  sourceLocation?: { file?: string; start?: number; end?: number };
};

export type CompileFacetInput = {
  name: string;
  path: string;
  content: string;
};

export type SelectorEntry = {
  selector: string;
  signature: string;
  facet: string;
  collision: boolean;
};

export type StorageEntry = {
  label: string;
  constant: string;
  facets: string[];
};

export type DiamondValidation = {
  ok: boolean;
  messages: string[];
  creationHash?: string;
  runtimeHash?: string;
  creationBytes?: number;
  runtimeBytes?: number;
  selectors: SelectorEntry[];
  storage: StorageEntry[];
  collisionCount: number;
};

export type DiamondCompileResult = {
  diagnostics: CompilerDiagnostic[];
  validation: DiamondValidation;
};

export const PINNED_SOLC_VERSION = "0.8.30";
const RUNTIME_BYTECODE_LIMIT = 24576;
const CREATION_BYTECODE_LIMIT = 49152;
const STORAGE_POSITION_PATTERN =
  /bytes32\s+(?:constant\s+)?(\w*STORAGE_POSITION\w*)\s*=\s*keccak256\("([^"]+)"\)/g;

const compilerSettings = {
  optimizer: { enabled: true, runs: 200 },
  evmVersion: "paris",
  metadata: { bytecodeHash: "ipfs", appendCBOR: true, useLiteralContent: true },
  outputSelection: {
    "*": {
      "": ["ast"],
      "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "evm.methodIdentifiers"],
    },
  },
};

function hexBytes(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]*$/i.test(value)
    ? value.length / 2
    : 0;
}

function normalizeFacetPath(path: string): string {
  return path.startsWith("./") ? path.slice(2) : path;
}

function buildSourceClosure(
  requested: Record<string, string>,
  allSources: Record<string, string>,
): Record<string, string> {
  const closure: Record<string, string> = {};
  const pending = Object.keys(requested);
  const importPattern = /\bimport\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g;

  while (pending.length) {
    const sourceName = pending.pop()!;
    if (Object.hasOwn(closure, sourceName)) continue;
    const content = requested[sourceName] ?? allSources[sourceName];
    if (typeof content !== "string")
      throw new Error(`Missing source in compiler closure: ${sourceName}.`);
    closure[sourceName] = content;
    for (const match of content.matchAll(importPattern)) {
      const specifier = match[1];
      const resolved = specifier.startsWith(".")
        ? `${specifier.slice(0, specifier.lastIndexOf("/") + 1)}${specifier.slice(specifier.lastIndexOf("/") + 1)}`
        : specifier;
      const sourcePath = resolved.startsWith(".")
        ? new URL(resolved, `https://compose.local/${sourceName}`).pathname.slice(1)
        : resolved;
      if (!Object.hasOwn(requested, sourcePath) && !Object.hasOwn(allSources, sourcePath))
        throw new Error(`Missing imported source: ${specifier} from ${sourceName}.`);
      pending.push(sourcePath);
    }
  }

  return closure;
}

function emptyValidation(messages: string[] = []): DiamondValidation {
  return {
    ok: messages.length === 0,
    messages,
    selectors: [],
    storage: [],
    collisionCount: 0,
  };
}

function collectStorageEntries(facetInputs: CompileFacetInput[]): StorageEntry[] {
  const byLabel = new Map<string, { constants: Set<string>; facets: Set<string> }>();

  for (const facet of facetInputs) {
    for (const match of facet.content.matchAll(STORAGE_POSITION_PATTERN)) {
      const constant = match[1]!;
      const label = match[2]!;
      const entry = byLabel.get(label) ?? { constants: new Set<string>(), facets: new Set<string>() };
      entry.constants.add(constant);
      entry.facets.add(facet.name);
      byLabel.set(label, entry);
    }
  }

  return [...byLabel.entries()]
    .map(([label, entry]) => ({
      label,
      constant: [...entry.constants].sort().join(", "),
      facets: [...entry.facets].sort(),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function collectSelectorEntries(
  output: Record<string, any>,
  facetInputs: CompileFacetInput[],
): { selectors: SelectorEntry[]; collisionCount: number; messages: string[] } {
  const selectors: SelectorEntry[] = [];
  const messages: string[] = [];
  const bySelector = new Map<string, string[]>();

  for (const facet of facetInputs) {
    const contract =
      output.contracts?.[facet.path]?.[facet.name] ??
      (output.contracts?.[facet.path]
        ? Object.values(output.contracts[facet.path])[0]
        : undefined);

    if (!contract) {
      messages.push(`Facet did not produce a ${facet.name} contract.`);
      continue;
    }

    const runtime = contract.evm?.deployedBytecode?.object ?? "";
    const runtimeBytes = hexBytes(runtime);
    if (runtimeBytes > RUNTIME_BYTECODE_LIMIT) {
      messages.push(
        `${facet.name} runtime bytecode exceeds the EVM limit (${runtimeBytes} > ${RUNTIME_BYTECODE_LIMIT} bytes).`,
      );
    }

    const abi = Array.isArray(contract.abi) ? contract.abi : [];
    const hasExportSelectors = abi.some(
      (item: { type?: string; name?: string }) =>
        item.type === "function" && item.name === "exportSelectors",
    );
    if (!hasExportSelectors) {
      messages.push(
        `${facet.name} is missing exportSelectors(). Module integration will fail.`,
      );
    }

    const methodIdentifiers: Record<string, string> =
      contract.evm?.methodIdentifiers ?? {};
    for (const [signature, selector] of Object.entries(methodIdentifiers)) {
      if (signature === "exportSelectors()") continue;
      const normalized = selector.startsWith("0x") ? selector.toLowerCase() : `0x${selector.toLowerCase()}`;
      const owners = bySelector.get(normalized) ?? [];
      if (!owners.includes(facet.name)) owners.push(facet.name);
      bySelector.set(normalized, owners);
      selectors.push({
        selector: normalized,
        signature,
        facet: facet.name,
        collision: false,
      });
    }
  }

  let collisionCount = 0;
  for (const entry of selectors) {
    const owners = bySelector.get(entry.selector) ?? [];
    if (owners.length > 1) {
      entry.collision = true;
      collisionCount += 1;
    }
  }

  if (collisionCount > 0) {
    const collisionDetails = [...bySelector.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([selector, owners]) => `${selector} claimed by ${owners.join(", ")}`);
    messages.push(`Selector collision: ${collisionDetails.join("; ")}.`);
  }

  selectors.sort((left, right) => {
    if (left.signature === right.signature) return left.facet.localeCompare(right.facet);
    return left.signature.localeCompare(right.signature);
  });

  return { selectors, collisionCount, messages };
}

function validateDiamondOutput(
  output: Record<string, any>,
  facetInputs: CompileFacetInput[],
): DiamondValidation {
  const messages: string[] = [];
  const contract = output.contracts?.["contracts/Diamond.sol"]?.Diamond;
  if (!contract)
    return emptyValidation(["The generated project did not produce its main contract."]);

  const abi = Array.isArray(contract.abi) ? contract.abi : [];
  const constructor = abi.find((item: { type?: string }) => item.type === "constructor");
  const constructorOk =
    !!constructor &&
    constructor.stateMutability === "nonpayable" &&
    constructor.inputs?.length === 1 &&
    constructor.inputs[0]?.type === "address[]";
  if (!constructorOk)
    messages.push("The generated contract must have one nonpayable address[] constructor.");

  const hasFallback = abi.some((item: { type?: string }) => item.type === "fallback");
  if (!hasFallback) messages.push("The generated contract has no fallback route.");

  const creation = contract.evm?.bytecode?.object ?? "";
  const runtime = contract.evm?.deployedBytecode?.object ?? "";
  const creationBytes = hexBytes(creation);
  const runtimeBytes = hexBytes(runtime);
  if (!creationBytes) messages.push("The generated contract has no creation bytecode.");
  if (creationBytes > CREATION_BYTECODE_LIMIT)
    messages.push("Creation bytecode exceeds the EVM limit.");
  if (runtimeBytes > RUNTIME_BYTECODE_LIMIT)
    messages.push("Runtime bytecode exceeds the EVM limit.");

  const selectorResult = collectSelectorEntries(output, facetInputs);
  messages.push(...selectorResult.messages);

  const storage = collectStorageEntries(facetInputs);
  const inspectFacet = facetInputs.find((facet) => facet.name === "DiamondInspectFacet");
  if (facetInputs.length > 0 && !inspectFacet) {
    messages.push("An inspection module is required for contract introspection and is missing.");
  } else if (inspectFacet) {
    const methodIdentifiers: Record<string, string> =
      output.contracts?.[inspectFacet.path]?.DiamondInspectFacet?.evm?.methodIdentifiers ?? {};
    const loupeSelectors = [
      "facetAddress(bytes4)",
      "facetFunctionSelectors(address)",
      "facetAddresses()",
      "facets()",
    ];
    const missingLoupe = loupeSelectors.filter(
      (signature) => !(signature in methodIdentifiers),
    );
    if (missingLoupe.length > 0) {
      messages.push(
        `The inspection module is missing required selectors: ${missingLoupe.join(", ")}.`,
      );
    }
  }

  return {
    ok: messages.length === 0,
    messages,
    creationHash: creation ? keccak256(`0x${creation}` as Hex) : undefined,
    runtimeHash: runtime ? keccak256(`0x${runtime}` as Hex) : undefined,
    creationBytes,
    runtimeBytes,
    selectors: selectorResult.selectors,
    storage,
    collisionCount: selectorResult.collisionCount,
  };
}

export async function compileDiamond(
  source: string,
  facetInputs: CompileFacetInput[] = [],
  signal?: AbortSignal,
): Promise<DiamondCompileResult> {
  const manifestResponse = await fetch(
    `${import.meta.env.BASE_URL}compiler/compose-sources.json`,
    { signal },
  );
  if (!manifestResponse.ok) throw new Error("The pinned Compose sources could not load.");
  const manifest = (await manifestResponse.json()) as {
    sources: Record<string, string>;
  };
  const allSources = manifest.sources;
  const requested: Record<string, string> = { "contracts/Diamond.sol": source };
  for (const facet of facetInputs) {
    const path = normalizeFacetPath(facet.path);
    requested[path] = facet.content;
  }

  const closure = buildSourceClosure(requested, allSources);
  const normalizedFacets = facetInputs.map((facet) => ({
    ...facet,
    path: normalizeFacetPath(facet.path),
  }));

  const input = {
    language: "Solidity",
    sources: Object.fromEntries(
      Object.entries(closure).map(([name, content]) => [name, { content }]),
    ),
    settings: compilerSettings,
  };
  const worker = new Worker(`${import.meta.env.BASE_URL}compiler/solc-worker.js`);
  return await new Promise<DiamondCompileResult>((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => finish(new Error("Compilation timed out.")), 30_000);
    const finish = (error?: Error, result?: DiamondCompileResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = () => finish(new DOMException("Compilation cancelled.", "AbortError"));
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ type?: string; output?: string; message?: string }>) => {
      try {
        if (event.data?.type === "error") throw new Error(event.data.message ?? "Compilation failed.");
        if (event.data?.type !== "compiled" || typeof event.data.output !== "string")
          throw new Error("The compiler worker returned an invalid result.");
        const output = JSON.parse(event.data.output) as Record<string, any>;
        const diagnostics: CompilerDiagnostic[] = (output.errors ?? []).map((item: any) => ({
          severity: item.severity === "warning" ? "warning" : item.severity === "error" ? "error" : "info",
          message: item.formattedMessage ?? item.message ?? "Compiler diagnostic",
          sourceLocation: item.sourceLocation,
        }));
        const validation = validateDiamondOutput(output, normalizedFacets);
        finish(undefined, { diagnostics, validation });
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Compilation failed."));
      }
    };
    worker.onerror = () => finish(new Error("The compiler worker failed."));
    worker.onmessageerror = () => finish(new Error("The compiler returned an unreadable result."));
    worker.postMessage({ input: JSON.stringify(input), sources: manifest.sources });
  });
}

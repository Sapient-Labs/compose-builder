import { keccak256 } from "viem";
import type { Hex } from "viem";

export type CompilerDiagnostic = {
  severity: "error" | "warning" | "info";
  message: string;
  sourceLocation?: { file?: string; start?: number; end?: number };
};

export type DiamondValidation = {
  ok: boolean;
  messages: string[];
  creationHash?: string;
  runtimeHash?: string;
  creationBytes?: number;
  runtimeBytes?: number;
};

export type DiamondCompileResult = {
  diagnostics: CompilerDiagnostic[];
  validation: DiamondValidation;
};

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

function validateContract(output: Record<string, any>): DiamondValidation {
  const messages: string[] = [];
  const contract = output.contracts?.["contracts/Diamond.sol"]?.Diamond;
  if (!contract) return { ok: false, messages: ["Diamond.sol did not produce a Diamond contract."] };
  const abi = Array.isArray(contract.abi) ? contract.abi : [];
  const constructor = abi.find((item: { type?: string }) => item.type === "constructor");
  if (
    !constructor ||
    constructor.stateMutability !== "nonpayable" ||
    constructor.inputs?.length !== 1 ||
    constructor.inputs[0]?.type !== "address[]"
  )
    messages.push("The generated Diamond must have one nonpayable address[] constructor.");
  if (!abi.some((item: { type?: string }) => item.type === "fallback"))
    messages.push("The generated Diamond has no fallback route.");
  const creation = contract.evm?.bytecode?.object ?? "";
  const runtime = contract.evm?.deployedBytecode?.object ?? "";
  const creationBytes = hexBytes(creation);
  const runtimeBytes = hexBytes(runtime);
  if (!creationBytes) messages.push("The generated Diamond has no creation bytecode.");
  if (creationBytes > 49152) messages.push("Creation bytecode exceeds the EVM limit.");
  if (runtimeBytes > 24576) messages.push("Runtime bytecode exceeds the EVM limit.");
  return {
    ok: messages.length === 0,
    messages,
    creationHash: creation ? keccak256(`0x${creation}` as Hex) : undefined,
    runtimeHash: runtime ? keccak256(`0x${runtime}` as Hex) : undefined,
    creationBytes,
    runtimeBytes,
  };
}

export async function compileDiamond(
  source: string,
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
  const closure: Record<string, string> = {};
  const pending = ["contracts/Diamond.sol"];
  const requested: Record<string, string> = { "contracts/Diamond.sol": source };
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
  const input = {
    language: "Solidity",
    sources: {
      ...Object.fromEntries(
        Object.entries(closure).map(([name, content]) => [name, { content }]),
      ),
      "contracts/Diamond.sol": { content: source },
    },
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
        const validation = validateContract(output);
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

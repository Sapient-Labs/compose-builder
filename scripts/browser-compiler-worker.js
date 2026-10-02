const COMPILER_VERSION = __COMPILER_VERSION__;
const COMPILER_ASSET = __COMPILER_ASSET__;
const COMPILER_ASSET_SHA256 = __COMPILER_ASSET_SHA256__;
const COMPOSE_SOURCE_HASHES = __COMPOSE_SOURCE_HASHES__;
let busy = false;

function errorMessage(error) {
  return error instanceof Error ? error.message : "Compiler worker failed.";
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function loadCompiler() {
  const response = await fetch(new URL(COMPILER_ASSET, location.href), {
    credentials: "same-origin",
    cache: "force-cache",
  });
  if (!response.ok) throw new Error("The pinned compiler asset could not load.");
  const bytes = await response.arrayBuffer();
  if ((await sha256(bytes)) !== COMPILER_ASSET_SHA256)
    throw new Error("The compiler asset hash does not match the pinned build.");
  const blob = new Blob([bytes], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  try {
    importScripts(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const version = Module.cwrap("solidity_version", "string", [])();
  if (version !== COMPILER_VERSION)
    throw new Error("The compiler version does not match the pinned build.");
  return Module;
}

async function validateSources(sources) {
  if (!sources || typeof sources !== "object" || Array.isArray(sources))
    throw new Error("Compiler sources are invalid.");
  const names = Object.keys(sources);
  if (!names.length || names.length > Object.keys(COMPOSE_SOURCE_HASHES).length)
    throw new Error("The Compose source closure is invalid.");
  for (const name of names) {
    if (!Object.hasOwn(COMPOSE_SOURCE_HASHES, name) || typeof sources[name] !== "string")
      throw new Error(`Unknown Compose source: ${name}.`);
    if ((await sha256(new TextEncoder().encode(sources[name]))) !== COMPOSE_SOURCE_HASHES[name])
      throw new Error(`Compose source hash mismatch: ${name}.`);
  }
}

globalThis.onmessage = async (event) => {
  if (busy) {
    postMessage({ type: "error", message: "Compiler worker is busy." });
    return;
  }
  busy = true;
  let module;
  try {
    const request = event.data;
    if (!request || typeof request.input !== "string")
      throw new Error("Compiler input is invalid.");
    await validateSources(request.sources);
    module = await loadCompiler();
    const output = module.cwrap(
      "solidity_compile",
      "string",
      ["string", "number", "number"],
    )(request.input, 0, 0);
    module.cwrap("solidity_reset", null, [])();
    if (new TextEncoder().encode(output).byteLength > 8 * 1024 * 1024)
      throw new Error("Compiler output exceeds the 8 MiB safety limit.");
    postMessage({
      type: "compiled",
      output,
      version: COMPILER_VERSION,
      assetHash: COMPILER_ASSET_SHA256,
    });
  } catch (error) {
    try {
      module?.cwrap("solidity_reset", null, [])();
    } catch {
      // The worker is disposable; cleanup failure does not change the report.
    }
    postMessage({ type: "error", message: errorMessage(error) });
  } finally {
    busy = false;
  }
};

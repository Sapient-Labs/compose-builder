import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const solc = require("solc");
const composePackage = path.dirname(
  require.resolve("@perfect-abstractions/compose/package.json"),
);
const compilerVersion = "0.8.30+commit.73712a01.Emscripten.clang";
const compilerAsset = "soljson-0.8.30.js";
const outputDir = path.join(root, "public", "compiler");

if (solc.version() !== compilerVersion)
  throw new Error(`Expected ${compilerVersion}; found ${solc.version()}.`);

async function solidityFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory())
      files.push(...(await solidityFiles(path.join(directory, entry.name), relative)));
    else if (entry.isFile() && entry.name.endsWith(".sol")) files.push(relative);
  }
  return files.sort();
}

const sources = {};
const hashes = {};
for (const relative of await solidityFiles(composePackage)) {
  const content = await readFile(path.join(composePackage, relative), "utf8");
  const sourceName = `@perfect-abstractions/compose/${relative.split(path.sep).join("/")}`;
  sources[sourceName] = content;
  hashes[sourceName] = createHash("sha256").update(content).digest("hex");
}

const assetPath = require.resolve("solc/soljson.js");
const assetBytes = await readFile(assetPath);
const assetHash = createHash("sha256").update(assetBytes).digest("hex");
const manifest = {
  format: "compose-launchpad-compiler-sources",
  version: 1,
  composePackage: "@perfect-abstractions/compose@0.0.6",
  compilerVersion,
  compilerAsset,
  compilerAssetSha256: assetHash,
  sourceHashes: hashes,
  sources,
};

const workerTemplate = await readFile(
  path.join(root, "scripts", "browser-compiler-worker.js"),
  "utf8",
);
const worker = workerTemplate
  .replace("__COMPILER_VERSION__", JSON.stringify(compilerVersion))
  .replace("__COMPILER_ASSET__", JSON.stringify(compilerAsset))
  .replace("__COMPILER_ASSET_SHA256__", JSON.stringify(assetHash))
  .replace("__COMPOSE_SOURCE_HASHES__", JSON.stringify(hashes));

await mkdir(outputDir, { recursive: true });
await copyFile(assetPath, path.join(outputDir, compilerAsset));
await writeFile(
  path.join(outputDir, "compose-sources.json"),
  `${JSON.stringify(manifest)}\n`,
);
await writeFile(path.join(outputDir, "solc-worker.js"), worker);
console.log(
  `Prepared ${compilerVersion} and ${Object.keys(sources).length} Compose sources.`,
);

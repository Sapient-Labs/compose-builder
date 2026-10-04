// This module must only be imported by the disposable simulation worker (or tests).
import { createBlock } from "@ethereumjs/block";
import { Common, Mainnet } from "@ethereumjs/common";
import { SimpleStateManager } from "@ethereumjs/statemanager";
import { createLegacyTx } from "@ethereumjs/tx";
import { createAccount, createAddressFromPrivateKey, hexToBytes } from "@ethereumjs/util";
import { createVM, runTx } from "@ethereumjs/vm";
import { encodeAbiParameters } from "viem";
import type { Address, Hex } from "viem";
import type { DeploymentArtifact, DeploymentSimulationInput, DeploymentSimulationResult } from "./deploymentSimulation";

const FORK = "paris" as const;
const TRANSACTION_GAS_LIMIT = 30_000_000n;
const MAX_CREATION_BYTES = 49_152;
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
const MAX_FACETS = 128;
const TIMEOUT_MS = 30_000;

// Public deterministic test fixture, not a user's private key or a wallet.
// Its only use is signing local transactions inside this fresh, disconnected VM.
const FIXTURE_KEY = hexToBytes(`0x${"20".repeat(32)}`);

function creationBytecode(artifact: DeploymentArtifact): Hex {
  if (!artifact || typeof artifact !== "object"
    || typeof artifact.name !== "string" || !/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(artifact.name)
    || typeof artifact.path !== "string" || !artifact.path.length || artifact.path.length > 512) {
    throw new Error("A selected contract artifact is missing or invalid.");
  }
  const raw = artifact.bytecode;
  if (typeof raw === "string" && raw.length > MAX_CREATION_BYTES * 2 + 2) {
    throw new Error(`${artifact.name} exceeds the local simulation creation-bytecode limit.`);
  }
  if (typeof raw !== "string" || !/^(?:0x)?(?:[0-9a-fA-F]{2})+$/.test(raw)) {
    throw new Error(`${artifact.name} has missing, unlinked or invalid creation bytecode.`);
  }
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (hex.length / 2 > MAX_CREATION_BYTES) throw new Error(`${artifact.name} exceeds the local simulation creation-bytecode limit.`);
  return `0x${hex}`;
}

function validateInput(input: DeploymentSimulationInput) {
  if (!input || typeof input !== "object"
    || typeof input.compilerVersion !== "string" || !input.compilerVersion.length || input.compilerVersion.length > 128
    || typeof input.settingsFingerprint !== "string" || !/^0x[0-9a-f]{64}$/i.test(input.settingsFingerprint)) {
    throw new Error("Local gas simulation requires complete compiler artifacts and their settings identity.");
  }
  if (input.diamond?.name !== "Diamond" || input.diamond.path !== "contracts/Diamond.sol") {
    throw new Error("The compiled Diamond artifact is missing.");
  }
  const diamondCode = creationBytecode(input.diamond);
  if (!Array.isArray(input.diamond.constructorInputs)
    || input.diamond.constructorInputs.length !== 1
    || input.diamond.constructorInputs[0]?.type !== "address[]") {
    throw new Error("Diamond simulation requires exactly one address[] constructor argument.");
  }
  if (!Array.isArray(input.facets) || input.facets.length === 0 || input.facets.length > MAX_FACETS) {
    throw new Error(`Local gas simulation requires between 1 and ${MAX_FACETS} selected facets.`);
  }
  const names = new Set<string>();
  const facetCodes = input.facets.map((facet) => {
    const code = creationBytecode(facet);
    if (names.has(facet.name)) throw new Error(`Duplicate selected facet: ${facet.name}.`);
    names.add(facet.name);
    if (!Array.isArray(facet.constructorInputs) || facet.constructorInputs.length !== 0) {
      throw new Error(`${facet.name} has missing or unsupported constructor arguments.`);
    }
    return code;
  });
  if (!names.has("DiamondInspectFacet")) throw new Error("The required DiamondInspectFacet artifact is missing.");
  // Include the exact ABI address[] overhead before allocating/starting a VM.
  const encodedArgumentBytes = 64 + 32 * input.facets.length;
  if ((diamondCode.length - 2) / 2 + encodedArgumentBytes > MAX_CREATION_BYTES) {
    throw new Error("Diamond and its constructor arguments exceed the local simulation payload limit.");
  }
  const totalBytes = [diamondCode, ...facetCodes].reduce((sum, code) => sum + (code.length - 2) / 2, encodedArgumentBytes);
  if (totalBytes > MAX_PAYLOAD_BYTES) throw new Error("The selected deployment artifacts exceed the local simulation payload limit.");
  return { diamondCode, facetCodes };
}

/**
 * Deploy every selected real facet, then pass those exact addresses to Diamond.
 * No RPC client, provider, external account or persisted state is available here.
 * Setup costs are deliberately excluded from the returned Diamond measurement.
 */
export async function simulateDeployment(input: DeploymentSimulationInput): Promise<DeploymentSimulationResult> {
  const { diamondCode, facetCodes } = validateInput(input);
  const started = performance.now();
  const checkTime = () => {
    if (performance.now() - started >= TIMEOUT_MS) throw new Error("Local gas simulation timed out.");
  };
  const common = new Common({ chain: Mainnet, hardfork: FORK });
  // A new state manager for each job prevents state, warm slots or previous
  // deployments from leaking into this measurement. runTx resets access warmth.
  const vm = await createVM({ common, stateManager: new SimpleStateManager() });
  const sender = createAddressFromPrivateKey(FIXTURE_KEY);
  await vm.stateManager.putAccount(sender, createAccount({ nonce: 0n, balance: 10n ** 30n }));
  const block = createBlock({ header: { number: 1n, gasLimit: TRANSACTION_GAS_LIMIT, baseFeePerGas: 0n } }, { common });
  let nonce = 0n;
  const deploy = async (name: string, data: Hex) => {
    checkTime();
    const tx = createLegacyTx({ nonce: nonce++, gasPrice: 1n, gasLimit: TRANSACTION_GAS_LIMIT, value: 0n, data }, { common }).sign(FIXTURE_KEY);
    const result = await runTx(vm, { tx, block });
    checkTime();
    if (result.execResult.exceptionError) {
      throw new Error(`${name} deployment failed in the local Paris EVM: ${result.execResult.exceptionError.error}.`);
    }
    if (!result.createdAddress) throw new Error(`${name} deployment did not produce a contract address.`);
    const code = await vm.stateManager.getCode(result.createdAddress);
    if (!code.length) throw new Error(`${name} deployment did not produce runtime bytecode.`);
    return { address: result.createdAddress.toString() as Address, intrinsicGas: tx.getIntrinsicGas(), result };
  };
  const addresses: Address[] = [];
  for (let index = 0; index < input.facets.length; index++) {
    const facet = await deploy(input.facets[index].name, facetCodes[index]);
    addresses.push(facet.address);
  }
  const constructorArgs = encodeAbiParameters([{ type: "address[]" }], [addresses]);
  const diamond = await deploy("Diamond", `${diamondCode}${constructorArgs.slice(2)}`);
  const { totalGasSpent, execResult } = diamond.result;
  // EthereumJS exposes the raw refund counter separately. Derive the refund
  // actually applied so intrinsic + execution - refund precisely equals total.
  const gasRefund = diamond.intrinsicGas + execResult.executionGasUsed - totalGasSpent;
  if (totalGasSpent <= 0n || gasRefund < 0n) throw new Error("Local gas simulation produced an invalid gas result.");
  return {
    totalGasSpent: totalGasSpent.toString() as `${bigint}`,
    intrinsicGas: diamond.intrinsicGas.toString() as `${bigint}`,
    executionGasUsed: execResult.executionGasUsed.toString() as `${bigint}`,
    gasRefund: gasRefund.toString() as `${bigint}`,
    facetCount: addresses.length,
    fork: FORK,
    compilerVersion: input.compilerVersion,
    settingsFingerprint: input.settingsFingerprint,
  };
}

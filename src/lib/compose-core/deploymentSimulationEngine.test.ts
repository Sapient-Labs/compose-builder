// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import solc from 'solc';
import { keccak256, stringToHex } from 'viem';
import type { Abi } from 'viem';
import type { BasesCatalog } from '@/types/catalog';
import { DEFAULT_CONFIG } from '@/types/config';
import type { DiamondConfig } from '@/types/config';
import { planComposition } from './composition';
import type { DeploymentArtifact, DeploymentSimulationInput } from './deploymentSimulation';
import { simulateDeployment } from './deploymentSimulationEngine';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const catalog: BasesCatalog = { globals: {}, features: {} };
for (const file of readdirSync('public/bases')) {
  for (const [key, value] of Object.entries(
    JSON.parse(readFileSync(`public/bases/${file}`, 'utf8')),
  )) {
    Object.assign(
      ['diamond', 'libraries', 'examples'].includes(key) ? catalog.globals : catalog.features,
      { [key]: value },
    );
  }
}
const manifest = JSON.parse(readFileSync('public/compiler/compose-sources.json', 'utf8')) as {
  sources: Record<string, string>;
};
type AbiConstructor = Extract<Abi[number], { type: 'constructor' }>;
type CompiledContract = { abi: Abi; evm: { bytecode: { object: string } } };
function compileFixture(config: DiamondConfig, initialized = false): DeploymentSimulationInput {
  const plan = planComposition(catalog, config);
  const source = readFileSync(
    `src/lib/compose-core/__fixtures__/${initialized ? 'initialized' : config.baseKey === 'erc-20' ? 'erc20' : 'plain'}-diamond.sol`,
    'utf8',
  );
  const requested: Record<string, string> = { 'contracts/Diamond.sol': source };
  for (const facet of plan.facets) {
    const path = facet.entry.path.replace(/^\.\//, '');
    requested[path] = path.startsWith('src/templates/')
      ? readFileSync(`public/templates/${path.slice('src/templates/'.length)}`, 'utf8')
      : manifest.sources[path];
  }
  const closure: Record<string, { content: string }> = {};
  const pending = Object.keys(requested);
  while (pending.length) {
    const path = pending.pop()!;
    if (Object.hasOwn(closure, path)) continue;
    const content = requested[path] ?? manifest.sources[path];
    if (content === undefined) throw new Error(`Missing test source ${path}`);
    closure[path] = { content };
    for (const match of content.matchAll(/\bimport\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g)) {
      pending.push(
        match[1].startsWith('.')
          ? new URL(match[1], `https://compose.local/${path}`).pathname.slice(1)
          : match[1],
      );
    }
  }
  const input = JSON.stringify({
    language: 'Solidity',
    sources: closure,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
      metadata: { bytecodeHash: 'ipfs', appendCBOR: true, useLiteralContent: true },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  });
  const output = JSON.parse(solc.compile(input)) as {
    errors?: { severity: string; formattedMessage: string }[];
    contracts: Record<string, Record<string, CompiledContract>>;
  };
  const errors = output.errors?.filter((error) => error.severity === 'error') ?? [];
  if (errors.length) throw new Error(errors.map((error) => error.formattedMessage).join('\n'));
  const artifact = (name: string, path: string): DeploymentArtifact => {
    const contract = output.contracts[path][name];
    return {
      name,
      path,
      bytecode: contract.evm.bytecode.object,
      constructorInputs:
        (contract.abi.find((item) => item.type === 'constructor') as AbiConstructor | undefined)
          ?.inputs ?? [],
    };
  };
  return {
    diamond: artifact('Diamond', 'contracts/Diamond.sol'),
    facets: plan.facets.map((facet) => artifact(facet.name, facet.entry.path.replace(/^\.\//, ''))),
    compilerVersion: '0.8.30',
    settingsFingerprint: keccak256(stringToHex(input)),
  };
}

let blank: DeploymentSimulationInput;
let counter: DeploymentSimulationInput;
let erc20: DeploymentSimulationInput;
let initialized: DeploymentSimulationInput;
beforeAll(() => {
  blank = compileFixture(DEFAULT_CONFIG);
  counter = compileFixture({ ...DEFAULT_CONFIG, baseKey: 'counter' });
  erc20 = compileFixture({ ...DEFAULT_CONFIG, baseKey: 'erc-20' });
  initialized = compileFixture(
    {
      ...DEFAULT_CONFIG,
      baseKey: 'erc-20',
      selectedExtensions: ['ERC20MetadataFacet'],
      selectedAccess: ['owner'],
      selectedLibraries: ['ERC165Facet'],
    },
    true,
  );
}, 30_000);

describe('local deployment gas engine', () => {
  it('reproduces independently prototyped real selected-facet deployments on Paris', async () => {
    const fixtures = [blank, counter, erc20, initialized];
    const results = [];
    for (const fixture of fixtures) results.push(await simulateDeployment(fixture));
    expect(results.map((result) => result.totalGasSpent)).toEqual([
      '261239',
      '342544',
      '417352',
      '727864',
    ]);
    expect(results.map((result) => result.facetCount)).toEqual([1, 3, 4, 8]);
    expect(results.every((result) => result.fork === 'paris')).toBe(true);
    for (const result of results) {
      expect(BigInt(result.totalGasSpent)).toBe(
        BigInt(result.intrinsicGas) + BigInt(result.executionGasUsed) - BigInt(result.gasRefund),
      );
      // These are Diamond-only values: even the blank setup facet costs 573,962.
      expect(result).not.toHaveProperty('facetGas');
    }
  });

  it('reports only the refund actually applied by Paris', async () => {
    // Set then clear storage and return one STOP byte: refund exceeds the 1/5 cap.
    const refunding = {
      ...blank,
      diamond: { ...blank.diamond, bytecode: '60016000556000600055600060005360016000f3' },
    };
    const result = await simulateDeployment(refunding);
    const beforeRefund = BigInt(result.intrinsicGas) + BigInt(result.executionGasUsed);
    expect(BigInt(result.gasRefund)).toBe(beforeRefund / 5n);
    expect(BigInt(result.totalGasSpent)).toBe(beforeRefund - BigInt(result.gasRefund));
    expect(BigInt(result.gasRefund)).toBeGreaterThan(0n);
  });

  it('runs the selected facet bytecode instead of placeholder or count-only setup', async () => {
    const bad = structuredClone(counter);
    // A valid runtime contract whose exportSelectors call cannot decode.
    bad.facets[1].bytecode = '600060005360016000f3';
    await expect(simulateDeployment(bad)).rejects.toThrow('Diamond deployment failed');
  });

  it('starts with cold transaction access and fresh state on every job', async () => {
    const first = await simulateDeployment(counter);
    await simulateDeployment(initialized);
    expect(await simulateDeployment(counter)).toEqual(first);
  });

  it('never calls fetch or any wallet/RPC provider', async () => {
    const fetch = vi.fn(() => {
      throw new Error('Network is forbidden');
    });
    vi.stubGlobal('fetch', fetch);
    try {
      expect((await simulateDeployment(blank)).totalGasSpent).toBe('261239');
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fails closed rather than simulating the cheaper empty-facet shortcut', async () => {
    await expect(simulateDeployment({ ...counter, facets: [] })).rejects.toThrow('between 1');
    await expect(
      simulateDeployment({ ...counter, facets: counter.facets.slice(1) }),
    ).rejects.toThrow('DiamondInspectFacet');
  });

  it('requires every selected artifact and supported constructor', async () => {
    const missing = structuredClone(counter);
    missing.facets[1].bytecode = '';
    await expect(simulateDeployment(missing)).rejects.toThrow('CounterDataFacet');
    const facetConstructor = structuredClone(counter);
    facetConstructor.facets[1].constructorInputs = [{ type: 'uint256' }];
    await expect(simulateDeployment(facetConstructor)).rejects.toThrow('unsupported constructor');
    const diamondConstructor = structuredClone(counter);
    diamondConstructor.diamond.constructorInputs = [];
    await expect(simulateDeployment(diamondConstructor)).rejects.toThrow('address[]');
    await expect(
      simulateDeployment({ ...counter, facets: [...counter.facets, counter.facets[0]] }),
    ).rejects.toThrow('Duplicate');
  });

  it.each(['0x', '0x0', '0xzz', '0x60 00', '__$unlinked_library$__', '0X6000'])(
    'rejects invalid bytecode %s',
    async (bytecode) => {
      await expect(
        simulateDeployment({ ...blank, diamond: { ...blank.diamond, bytecode } }),
      ).rejects.toThrow('bytecode');
    },
  );

  it('rejects excessive bytecode, constructor payloads and facet counts', async () => {
    await expect(
      simulateDeployment({
        ...blank,
        diamond: { ...blank.diamond, bytecode: '60'.repeat(49_153) },
      }),
    ).rejects.toThrow('limit');
    await expect(
      simulateDeployment({
        ...blank,
        diamond: { ...blank.diamond, bytecode: '60'.repeat(49_152) },
      }),
    ).rejects.toThrow('payload limit');
    await expect(
      simulateDeployment({ ...blank, facets: Array.from({ length: 129 }, () => blank.facets[0]) }),
    ).rejects.toThrow('between 1');
    const tooManyBytes = Array.from({ length: 43 }, (_, index) => ({
      ...blank.facets[0],
      name: index === 0 ? 'DiamondInspectFacet' : `Facet${index}`,
      bytecode: '60'.repeat(49_000),
    }));
    await expect(simulateDeployment({ ...blank, facets: tooManyBytes })).rejects.toThrow(
      'payload limit',
    );
  });

  it('surfaces facet and Diamond reverts without a partial gas number', async () => {
    const badFacet = structuredClone(blank);
    badFacet.facets[0].bytecode = '60006000fd';
    await expect(simulateDeployment(badFacet)).rejects.toThrow(
      'DiamondInspectFacet deployment failed',
    );
    const badDiamond = { ...blank, diamond: { ...blank.diamond, bytecode: '60006000fd' } };
    await expect(simulateDeployment(badDiamond)).rejects.toThrow('Diamond deployment failed');
    // STOP is valid initcode but produces no runtime contract.
    await expect(
      simulateDeployment({ ...blank, diamond: { ...blank.diamond, bytecode: '00' } }),
    ).rejects.toThrow('runtime bytecode');
    // PUSH0 is unsupported by Paris, irrespective of newer-fork defaults.
    await expect(
      simulateDeployment({ ...blank, diamond: { ...blank.diamond, bytecode: '5f00' } }),
    ).rejects.toThrow('invalid opcode');
    // Huge memory allocation consumes the capped gas immediately.
    await expect(
      simulateDeployment({
        ...blank,
        diamond: { ...blank.diamond, bytecode: '600063ffffffff5200' },
      }),
    ).rejects.toThrow('out of gas');
  });
});

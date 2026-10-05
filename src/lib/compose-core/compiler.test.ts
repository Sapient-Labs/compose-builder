import { readFileSync } from 'node:fs';
import { keccak256 } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import solc from 'solc';
import { compileDiamond } from './compiler';
import type { CompileFacetInput } from './compiler';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const diamondSource = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
contract Diamond {
  constructor(address[] memory) {}
  function version() external pure returns (uint256) { return 1; }
  fallback() external payable {}
  receive() external payable {}
}`;

let compile: (input: string) => string;
let postedInput: Record<string, any>;
let manifest: {
  sources: Record<string, string>;
  version: number;
  composePackage: string;
  compilerVersion: string;
  compilerAssetSha256: string;
};
const terminate = vi.fn();

beforeEach(() => {
  compile = (input) => solc.compile(input);
  postedInput = {};
  manifest = {
    sources: {},
    version: 1,
    composePackage: '@perfect-abstractions/compose@0.0.6',
    compilerVersion: solc.version(),
    compilerAssetSha256: 'pinned-asset-hash',
  };
  terminate.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => manifest })),
  );
  vi.stubGlobal(
    'Worker',
    class {
      onmessage?: (event: { data: { type: string; output: string } }) => void;
      onerror?: () => void;
      onmessageerror?: () => void;
      terminate = terminate;
      postMessage({ input }: { input: string }) {
        postedInput = JSON.parse(input);
        queueMicrotask(() =>
          this.onmessage?.({ data: { type: 'compiled', output: compile(input) } }),
        );
      }
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('compiler gas estimates', () => {
  it('requests and preserves actual pinned-solc estimates with their compiler settings', async () => {
    const result = await compileDiamond(diamondSource);
    expect(postedInput.settings.outputSelection['*']['*']).toContain('evm.gasEstimates');
    expect(result.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    const raw = JSON.parse(solc.compile(JSON.stringify(postedInput))).contracts[
      'contracts/Diamond.sol'
    ].Diamond.evm.gasEstimates;
    expect(result.gasEstimates).toEqual({
      compilerVersion: '0.8.30',
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
      contracts: [
        {
          contract: 'Diamond',
          source: 'contracts/Diamond.sol',
          creation: raw.creation,
          external: raw.external,
          internal: raw.internal ?? {},
        },
      ],
    });
    expect(result.gasEstimates?.contracts[0].creation?.executionCost).toBe('infinite');
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('includes the exact selected facet and preserves zero and large values without numeric conversion', async () => {
    compile = () =>
      JSON.stringify({
        contracts: {
          'contracts/Diamond.sol': {
            Diamond: {
              evm: {
                gasEstimates: {
                  creation: {
                    codeDepositCost: '0',
                    executionCost: 'infinite',
                    totalCost: 'infinite',
                  },
                },
              },
            },
          },
          'facets/Selected.sol': {
            Selected: {
              evm: {
                gasEstimates: {
                  external: { 'version()': '9007199254740993' },
                  internal: { 'helper()': '0' },
                },
              },
            },
            Unselected: { evm: { gasEstimates: { external: { 'other()': '123' } } } },
          },
          'Dependency.sol': {
            Dependency: { evm: { gasEstimates: { external: { 'hidden()': '123' } } } },
          },
        },
      });
    const result = await compileDiamond(diamondSource, [
      { name: 'Selected', path: './facets/Selected.sol', content: 'contract Selected {}' },
    ]);
    expect(result.gasEstimates?.contracts.map((item) => item.contract)).toEqual([
      'Diamond',
      'Selected',
    ]);
    expect(result.gasEstimates?.contracts[0].creation?.codeDepositCost).toBe('0');
    expect(result.gasEstimates?.contracts[1]).toEqual({
      contract: 'Selected',
      source: 'facets/Selected.sol',
      creation: undefined,
      external: { 'version()': '9007199254740993' },
      internal: { 'helper()': '0' },
    });
  });

  it('leaves absent or malformed estimates unavailable instead of inventing values', async () => {
    compile = () =>
      JSON.stringify({
        contracts: {
          'contracts/Diamond.sol': {
            Diamond: {
              evm: {
                gasEstimates: {
                  creation: { totalCost: -2 },
                  external: { 'a()': 'NaN', 'b()': 123, 'c()': '-5' },
                },
              },
            },
          },
          'facets/Missing.sol': {
            OtherContract: { evm: { gasEstimates: { external: { 'wrong()': '123' } } } },
          },
        },
      });
    const malformed = await compileDiamond(diamondSource, [
      { name: 'Missing', path: 'facets/Missing.sol', content: 'contract OtherContract {}' },
    ]);
    expect(malformed.gasEstimates).toBeUndefined();
    compile = () =>
      JSON.stringify({ contracts: { 'contracts/Diamond.sol': { Diamond: { evm: {} } } } });
    expect((await compileDiamond(diamondSource)).gasEstimates).toBeUndefined();
  });

  it('returns real compiler diagnostics and no estimates after an invalid source', async () => {
    const result = await compileDiamond(
      'pragma solidity 0.8.30; contract Diamond { this is invalid }',
    );
    expect(result.diagnostics.some((item) => item.severity === 'error')).toBe(true);
    expect(result.gasEstimates).toBeUndefined();
  });
});

const basicOutput = () =>
  ({
    contracts: {
      'contracts/Diamond.sol': {
        Diamond: {
          abi: [
            {
              type: 'constructor',
              stateMutability: 'nonpayable',
              inputs: [{ type: 'address[]', name: '_facets' }],
            },
            { type: 'fallback' },
          ],
          evm: { bytecode: { object: '60006000f3' }, deployedBytecode: { object: '6000' } },
        },
      },
    },
  }) as Record<string, any>;

const testFacet = (name: string, path = `facets/${name}.sol`): CompileFacetInput => ({
  name,
  path,
  content: `pragma solidity 0.8.30; contract ${name} { function exportSelectors() external pure returns (bytes memory) { return hex"12345678"; } }`,
});

function addFacet(
  output: Record<string, any>,
  facet: CompileFacetInput,
  extra: Record<string, any> = {},
) {
  output.contracts[facet.path.replace(/^\.\//, '')] = {
    [facet.name]: {
      abi: [{ type: 'function', name: 'exportSelectors' }],
      evm: { bytecode: { object: '60006000f3' }, deployedBytecode: { object: '6000' } },
      ...extra,
    },
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const fingerprint = (value: unknown) => keccak256(new TextEncoder().encode(canonical(value)));

describe('deployment artifact retention', () => {
  it('retains exact creation bytecode and only constructor inputs from real solc output', async () => {
    const facet = testFacet('Selected', './facets/Selected.sol');
    const result = await compileDiamond(diamondSource, [facet]);
    const artifacts = result.deploymentArtifacts!;
    const raw = JSON.parse(solc.compile(JSON.stringify(postedInput)));
    expect(result.diagnostics.filter((entry) => entry.severity === 'error')).toEqual([]);
    expect(result.deploymentArtifactsError).toBeUndefined();
    expect(artifacts.diamond).toEqual({
      name: 'Diamond',
      path: 'contracts/Diamond.sol',
      bytecode: `0x${raw.contracts['contracts/Diamond.sol'].Diamond.evm.bytecode.object}`,
      constructorInputs: [{ name: '', type: 'address[]' }],
    });
    expect(artifacts.facets).toEqual([
      {
        name: 'Selected',
        path: 'facets/Selected.sol',
        bytecode: `0x${raw.contracts['facets/Selected.sol'].Selected.evm.bytecode.object}`,
        constructorInputs: [],
      },
    ]);
    expect(Object.keys(artifacts).sort()).toEqual([
      'compilerBuild',
      'compilerVersion',
      'composeSourceVersion',
      'diamond',
      'facets',
      'settings',
      'settingsFingerprint',
    ]);
    expect(JSON.stringify(artifacts)).not.toContain('"ast":');
    expect(JSON.stringify(artifacts)).not.toContain('"abi":');
  });

  it('retains real Compose Diamond and inspection/library facets in requested order', async () => {
    manifest = JSON.parse(readFileSync('public/compiler/compose-sources.json', 'utf8'));
    const source = `pragma solidity 0.8.30;
      import "@perfect-abstractions/compose/diamond/DiamondMod.sol" as DiamondMod;
      contract Diamond {
        constructor(address[] memory _facets) { DiamondMod.addFacets(_facets); }
        fallback() external payable { DiamondMod.diamondFallback(); }
        receive() external payable {}
      }`;
    const facets = [
      {
        name: 'ERC165Facet',
        path: '@perfect-abstractions/compose/interfaceDetection/ERC165/ERC165Facet.sol',
      },
      {
        name: 'DiamondInspectFacet',
        path: '@perfect-abstractions/compose/diamond/DiamondInspectFacet.sol',
      },
    ].map((facet) => ({ ...facet, content: manifest.sources[facet.path] }));
    const result = await compileDiamond(source, facets);
    expect(result.diagnostics.filter((entry) => entry.severity === 'error')).toEqual([]);
    expect(result.validation.ok).toBe(true);
    expect(result.deploymentArtifacts?.facets.map(({ name }) => name)).toEqual(
      facets.map(({ name }) => name),
    );
    expect(
      result.deploymentArtifacts?.facets.every(({ bytecode }) =>
        /^0x(?:[0-9a-f]{2})+$/.test(bytecode),
      ),
    ).toBe(true);
    expect(result.deploymentArtifacts?.composeSourceVersion).toBe(
      '@perfect-abstractions/compose@0.0.6',
    );
  });

  it('does not substitute another contract or silently omit a selected facet', async () => {
    const selected = testFacet('Selected');
    const output = basicOutput();
    addFacet(output, { ...selected, name: 'Unselected' });
    compile = () => JSON.stringify(output);
    const result = await compileDiamond(diamondSource, [selected]);
    expect(result.deploymentArtifacts).toBeUndefined();
    expect(result.deploymentArtifactsError).toContain('Selected');
    delete output.contracts['contracts/Diamond.sol'].Diamond;
    output.contracts['contracts/Diamond.sol'].OtherDiamond = {};
    expect((await compileDiamond(diamondSource)).deploymentArtifacts).toBeUndefined();
  });

  it.each(['', '0', '600', '0x6000', 'zz00', '60__$0123456789012345678901234567890123$__', null])(
    'rejects malformed or unlinked creation bytecode %j',
    async (bytecode) => {
      const facet = testFacet('Selected');
      const output = basicOutput();
      addFacet(output, facet);
      compile = () => JSON.stringify(output);
      output.contracts[facet.path].Selected.evm.bytecode.object = bytecode;
      const facetResult = await compileDiamond(diamondSource, [facet]);
      expect(facetResult.deploymentArtifacts).toBeUndefined();
      expect(facetResult.deploymentArtifactsError).toContain('creation bytecode');
      output.contracts['contracts/Diamond.sol'].Diamond.evm.bytecode.object = bytecode;
      const diamondResult = await compileDiamond(diamondSource);
      expect(diamondResult.deploymentArtifacts).toBeUndefined();
      expect(diamondResult.deploymentArtifactsError).toContain('creation bytecode');
    },
  );

  it('withholds artifacts whenever solc reports an error, even if contracts were returned', async () => {
    compile = () =>
      JSON.stringify({
        ...basicOutput(),
        errors: [{ severity: 'error', message: 'Compilation failed' }],
      });
    const result = await compileDiamond(diamondSource);
    expect(result.deploymentArtifacts).toBeUndefined();
    expect(result.deploymentArtifactsError).toContain('compiler errors');
  });

  it.each([
    { abi: [] },
    { abi: [{ type: 'constructor', stateMutability: 'payable', inputs: [{ type: 'address[]' }] }] },
    {
      abi: [{ type: 'constructor', stateMutability: 'nonpayable', inputs: [{ type: 'address' }] }],
    },
    { abi: [{ type: 'constructor', stateMutability: 'nonpayable', inputs: [] }] },
  ])('requires the exact supported Diamond constructor $abi', async ({ abi }) => {
    const output = basicOutput();
    output.contracts['contracts/Diamond.sol'].Diamond.abi = abi;
    compile = () => JSON.stringify(output);
    const result = await compileDiamond(diamondSource);
    expect(result.deploymentArtifacts).toBeUndefined();
    expect(result.deploymentArtifactsError).toContain('address[] constructor');
  });

  it('rejects parameterized or unknown facet constructors but supports explicit zero-argument constructors', async () => {
    const facet = testFacet('Selected');
    const output = basicOutput();
    addFacet(output, facet, {
      abi: [{ type: 'constructor', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }] }],
    });
    compile = () => JSON.stringify(output);
    const unsupported = await compileDiamond(diamondSource, [facet]);
    expect(unsupported.deploymentArtifacts).toBeUndefined();
    expect(unsupported.deploymentArtifactsError).toContain('zero-argument');
    output.contracts[facet.path].Selected.abi[0].inputs = [];
    expect(
      (await compileDiamond(diamondSource, [facet])).deploymentArtifacts?.facets[0]
        .constructorInputs,
    ).toEqual([]);
    delete output.contracts[facet.path].Selected.abi;
    expect((await compileDiamond(diamondSource, [facet])).deploymentArtifactsError).toContain(
      'Constructor information',
    );
  });

  it('fails closed for missing source-version metadata', async () => {
    manifest.composePackage = '';
    compile = () => JSON.stringify(basicOutput());
    const result = await compileDiamond(diamondSource);
    expect(result.deploymentArtifacts).toBeUndefined();
    expect(result.deploymentArtifactsError).toContain('source-version');
  });

  it('fingerprints all current compiler settings, source versions, complete sources and deployable targets', async () => {
    const result = await compileDiamond(diamondSource);
    const artifacts = result.deploymentArtifacts!;
    expect(artifacts.settings).toEqual(postedInput.settings);
    expect(artifacts.settings).toMatchObject({
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
      metadata: { bytecodeHash: 'ipfs', appendCBOR: true, useLiteralContent: true },
    });
    const provenance = {
      format: 'compose-local-deployment-v1',
      compilerVersion: '0.8.30',
      compilerBuild: manifest.compilerVersion,
      compilerAssetSha256: manifest.compilerAssetSha256,
      composeSourceVersion: manifest.composePackage,
      sourceManifestVersion: manifest.version,
      language: 'Solidity',
      settings: postedInput.settings,
      sources: { 'contracts/Diamond.sol': diamondSource },
      selectedFacets: [],
      diamond: artifacts.diamond,
      facets: [],
    };
    expect(artifacts.settingsFingerprint).toBe(fingerprint(provenance));
    for (const settings of [
      { ...postedInput.settings, optimizer: { enabled: true, runs: 201 } },
      { ...postedInput.settings, evmVersion: 'shanghai' },
      {
        ...postedInput.settings,
        metadata: { ...postedInput.settings.metadata, bytecodeHash: 'none' },
      },
      { ...postedInput.settings, outputSelection: {} },
    ])
      expect(artifacts.settingsFingerprint).not.toBe(fingerprint({ ...provenance, settings }));
    // A consumer modifying retained metadata must not change future compiler requests.
    artifacts.settings.optimizer.runs = 999;
    expect((await compileDiamond(diamondSource)).deploymentArtifacts?.settings.optimizer.runs).toBe(
      200,
    );
  });

  it('preserves facet order in both artifacts and identity, without deduplicating selections', async () => {
    const alpha = testFacet('Alpha'),
      beta = testFacet('Beta');
    const output = basicOutput();
    addFacet(output, alpha);
    addFacet(output, beta);
    compile = () => JSON.stringify(output);
    const first = (await compileDiamond(diamondSource, [alpha, beta])).deploymentArtifacts!;
    const reordered = (await compileDiamond(diamondSource, [beta, alpha])).deploymentArtifacts!;
    expect(first.facets.map(({ name }) => name)).toEqual(['Alpha', 'Beta']);
    expect(reordered.facets.map(({ name }) => name)).toEqual(['Beta', 'Alpha']);
    expect(reordered.settingsFingerprint).not.toBe(first.settingsFingerprint);
    const duplicate = (await compileDiamond(diamondSource, [alpha, alpha])).deploymentArtifacts!;
    expect(duplicate.facets).toHaveLength(2);
    const normalized = (
      await compileDiamond(diamondSource, [{ ...alpha, path: `./${alpha.path}` }, beta])
    ).deploymentArtifacts!;
    expect(normalized.settingsFingerprint).toBe(first.settingsFingerprint);
  });

  it('changes identity for imported sources, generated initializers, names, paths, source versions and output bytecode', async () => {
    const facet = testFacet('Selected');
    const output = basicOutput();
    addFacet(output, facet);
    const source = `import "dependency.sol";\n${diamondSource}`;
    manifest.sources = {
      'dependency.sol': 'pragma solidity 0.8.30; library Dependency {}',
      'unrelated.sol': 'original',
    };
    compile = () => JSON.stringify(output);
    const first = (await compileDiamond(source, [facet])).deploymentArtifacts!.settingsFingerprint;
    manifest.sources['unrelated.sol'] = 'changed';
    expect((await compileDiamond(source, [facet])).deploymentArtifacts!.settingsFingerprint).toBe(
      first,
    );
    manifest.sources['dependency.sol'] += ' // dependency changed';
    expect(
      (await compileDiamond(source, [facet])).deploymentArtifacts!.settingsFingerprint,
    ).not.toBe(first);
    manifest.sources['dependency.sol'] = 'pragma solidity 0.8.30; library Dependency {}';
    const initializer = source.replace(
      'constructor(address[] memory) {}',
      'constructor(address[] memory) { uint256 initialized = 1; }',
    );
    expect(
      (await compileDiamond(initializer, [facet])).deploymentArtifacts!.settingsFingerprint,
    ).not.toBe(first);
    manifest.composePackage = '@perfect-abstractions/compose@0.0.7';
    expect(
      (await compileDiamond(source, [facet])).deploymentArtifacts!.settingsFingerprint,
    ).not.toBe(first);
    manifest.composePackage = '@perfect-abstractions/compose@0.0.6';
    const renamed = { ...facet, name: 'Renamed' };
    addFacet(output, renamed);
    expect(
      (await compileDiamond(source, [renamed])).deploymentArtifacts!.settingsFingerprint,
    ).not.toBe(first);
    addFacet(output, facet);
    const moved = { ...facet, path: 'moved/Selected.sol' };
    addFacet(output, moved);
    expect(
      (await compileDiamond(source, [moved])).deploymentArtifacts!.settingsFingerprint,
    ).not.toBe(first);
    output.contracts[facet.path].Selected.evm.bytecode.object = '60016000f3';
    expect(
      (await compileDiamond(source, [facet])).deploymentArtifacts!.settingsFingerprint,
    ).not.toBe(first);
  });
});

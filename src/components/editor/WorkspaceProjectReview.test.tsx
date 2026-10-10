import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { DiamondCompileResult } from '@/lib/compose-core/compiler';
import { GasEstimatePanel, ProjectDataPanel } from './WorkspaceProjectReview';

const result: DiamondCompileResult = {
  diagnostics: [],
  validation: {
    ok: true,
    messages: [],
    selectors: [
      { selector: '0x12345678', signature: 'increment()', facet: 'CounterFacet', collision: false },
    ],
    storage: [
      {
        label: 'compose.counter',
        constant: 'COUNTER_STORAGE_POSITION',
        facets: ['CounterFacet', 'CounterResetFacet'],
      },
    ],
    collisionCount: 0,
  },
  gasEstimates: {
    compilerVersion: '0.8.30',
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris',
    contracts: [
      {
        contract: 'Diamond',
        source: 'contracts/Diamond.sol',
        creation: { codeDepositCost: '420000', executionCost: 'infinite', totalCost: 'infinite' },
        external: { 'version()': '0', 'large()': '9007199254740993' },
        internal: {},
      },
    ],
  },
};

beforeEach(() => {
  // Keep live pricing offline and deterministic; individual tests stub success paths.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const selectStorage = () =>
  fireEvent.mouseDown(screen.getByRole('tab', { name: /Storage/ }), { button: 0, ctrlKey: false });

describe('Project data panel', () => {
  it('shows the current selectors and source-derived storage without modifying configuration', () => {
    render(<ProjectDataPanel currentCompileResult={result} compiling={false} />);
    expect(screen.getByRole('table', { name: 'Exported function selectors' })).toBeTruthy();
    expect(screen.getByText('increment()')).toBeTruthy();
    expect(screen.getByText('0x12345678')).toBeTruthy();
    selectStorage();
    expect(screen.getByRole('table', { name: 'Storage slots' })).toBeTruthy();
    expect(screen.getByText('COUNTER_STORAGE_POSITION')).toBeTruthy();
    expect(screen.getByText('CounterFacet, CounterResetFacet')).toBeTruthy();
    expect(screen.getByText(/not a full compiler storage layout/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('preserves the Storage tab across hidden Project mode and recompilation', () => {
    const view = (hidden: boolean, compiling = false) => (
      <section hidden={hidden}>
        <ProjectDataPanel currentCompileResult={result} compiling={compiling} />
      </section>
    );
    const { rerender } = render(view(false));
    selectStorage();
    rerender(view(true));
    rerender(view(false, true));
    expect(screen.getByRole('status').textContent).toContain('Compiling project data');
    expect(screen.queryByText('COUNTER_STORAGE_POSITION')).toBeNull();
    rerender(view(false));
    expect(screen.getByRole('tab', { name: /Storage/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('COUNTER_STORAGE_POSITION')).toBeTruthy();
  });

  it('shows selector collisions and validation messages', () => {
    const invalid = {
      ...result,
      validation: {
        ...result.validation,
        ok: false,
        collisionCount: 1,
        messages: ['Selector collision: 0x12345678 claimed by two facets.'],
        selectors: [{ ...result.validation.selectors[0], collision: true }],
      },
    };
    render(<ProjectDataPanel currentCompileResult={invalid} compiling={false} />);
    expect(screen.getByRole('alert').textContent).toContain('claimed by two facets');
    expect(screen.getByText('collision')).toBeTruthy();
  });

  it('shows compiler failures and hides obsolete data', () => {
    const { rerender } = render(
      <ProjectDataPanel
        currentCompileResult={result}
        compiling={false}
        currentCompileError="Compiler asset unavailable"
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Compiler asset unavailable');
    expect(screen.queryByText('increment()')).toBeNull();
    rerender(
      <ProjectDataPanel
        currentCompileResult={{
          ...result,
          diagnostics: [{ severity: 'error', message: 'Invalid constructor' }],
        }}
        compiling={false}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Invalid constructor');
    expect(screen.queryByText('increment()')).toBeNull();
  });

  it('distinguishes uncompiled and successfully compiled empty projects', () => {
    const { rerender } = render(<ProjectDataPanel compiling={false} />);
    expect(screen.getByRole('status').textContent).toContain('Compile the project');
    rerender(
      <ProjectDataPanel
        currentCompileResult={{
          ...result,
          validation: { ...result.validation, selectors: [], storage: [] },
        }}
        compiling={false}
      />,
    );
    expect(screen.getByText('No selectors available for this project.')).toBeTruthy();
    selectStorage();
    expect(screen.getByText('No storage positions declared in selected facets.')).toBeTruthy();
  });
});

const cliCommand =
  'npx @perfect-abstractions/compose init my-diamond --base counter --owner --framework foundry';
const simulated = {
  totalGasSpent: '424242' as const,
  intrinsicGas: '53000' as const,
  executionGasUsed: '371242' as const,
  gasRefund: '0' as const,
  facetDeployments: [
    { name: 'CounterDataFacet', totalGasSpent: '100000' as const },
    { name: 'CounterIncrementFacet', totalGasSpent: '120000' as const },
    { name: 'DiamondInspectFacet', totalGasSpent: '200000' as const },
  ],
  facetsTotalGasSpent: '420000' as const,
  fullTotalGasSpent: '844242' as const,
  facetCount: 3,
  fork: 'paris' as const,
  compilerVersion: '0.8.30',
  settingsFingerprint: '0x' + '1'.repeat(64),
};
const gasBox = () => within(screen.getByRole('region', { name: 'Deployment gas estimate' }));
const commandBox = () => within(screen.getByRole('region', { name: 'Compose CLI command' }));

describe('Gas estimate panel', () => {
  it('stacks exactly two compact content-height boxes below the aligned pane header', () => {
    render(
      <GasEstimatePanel currentCompileResult={result} compiling={false} cliCommand={cliCommand} />,
    );
    expect(
      screen
        .getByRole('heading', { name: 'Project summary' })
        .parentElement!.classList.contains('workspace-pane-header'),
    ).toBe(true);
    const boxes = screen.getAllByRole('region');
    expect(boxes).toHaveLength(2);
    expect(boxes.map((box) => box.getAttribute('aria-label'))).toEqual([
      'Deployment gas estimate',
      'Compose CLI command',
    ]);
    expect(boxes[0].parentElement).toBe(boxes[1].parentElement);
    expect(Array.from(boxes[0].parentElement!.children)).toEqual(boxes);
    expect(boxes[0].parentElement!.classList.contains('flex-col')).toBe(true);
    expect(
      screen.getByLabelText('Compose command').parentElement!.classList.contains('max-h-40'),
    ).toBe(true);
    expect(
      screen.getByLabelText('Compose command').parentElement!.classList.contains('overflow-auto'),
    ).toBe(true);
    for (const box of boxes) {
      expect(box.classList.contains('border')).toBe(true);
      expect(box.classList.contains('shrink-0')).toBe(true);
      expect(box.className).not.toMatch(/(?:^|\s)(?:h-full|h-1\/2|flex-1|grow)(?:\s|$)/);
    }
    const code = screen.getByLabelText('Compose command');
    expect(code.tagName).toBe('CODE');
    expect(code.textContent?.replace(/\n  /g, ' ')).toBe(cliCommand);
    expect(code.parentElement!.classList.contains('whitespace-pre-wrap')).toBe(true);
    expect(code.parentElement!.classList.contains('[overflow-wrap:anywhere]')).toBe(true);
  });

  it('uses actual simulated transaction gas, never the static partial or infinite estimates', () => {
    render(
      <GasEstimatePanel
        currentCompileResult={result}
        compiling={false}
        cliCommand={cliCommand}
        deploymentEstimate={{ status: 'ready', result: simulated }}
      />,
    );
    expect(screen.getByText('424,242 gas')).toBeTruthy();
    expect(screen.getByText('844,242 gas')).toBeTruthy();
    expect(screen.queryByText('420,000 gas')).toBeNull();
    expect(screen.queryByText(/Code deposit|External functions|Internal functions/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Breakdown & pricing' }));
    expect(screen.getByText('420,000 gas')).toBeTruthy();
    expect(screen.getByText('CounterDataFacet')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Gas', { selector: 'input' }), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('ETH price in USD, approximately USDC'), {
      target: { value: '2000' },
    });
    expect(screen.getByRole('link', { name: 'Etherscan' })).toBeTruthy();
  });

  it('shows per-facet gas and prices both deployment assumptions in USDC', () => {
    render(
      <GasEstimatePanel
        currentCompileResult={result}
        compiling={false}
        cliCommand={cliCommand}
        deploymentEstimate={{ status: 'ready', result: simulated }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Breakdown & pricing' }));
    expect(screen.getByText('CounterDataFacet')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Gas', { selector: 'input' }), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('ETH price in USD, approximately USDC'), {
      target: { value: '2000' },
    });
    expect(screen.getByText('$16.88')).toBeTruthy();
    expect(screen.getByText(/844,242 gas × 10 Gwei × \$2000 = \$16\.88 USDC/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Predeployed facets/));
    expect(screen.getByText('$8.48')).toBeTruthy();
    expect(screen.getByText(/424,242 gas × 10 Gwei × \$2000 = \$8\.48 USDC/)).toBeTruthy();
  });

  it('opens the drawer from the empty USDC preview', () => {
    render(
      <GasEstimatePanel
        currentCompileResult={result}
        compiling={false}
        cliCommand={cliCommand}
        deploymentEstimate={{ status: 'ready', result: simulated }}
      />,
    );
    expect(screen.queryByText('420,000 gas')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Set gas and ETH prices/ }));
    expect(screen.getByText('420,000 gas')).toBeTruthy();
    expect(screen.getByLabelText('ETH price in USD, approximately USDC')).toBeTruthy();
  });

  it('preserves integer precision when formatting gas', () => {
    render(
      <GasEstimatePanel
        currentCompileResult={result}
        compiling={false}
        cliCommand={cliCommand}
        deploymentEstimate={{
          status: 'ready',
          result: { ...simulated, totalGasSpent: '9007199254740993' },
        }}
      />,
    );
    expect(screen.getByText('9,007,199,254,740,993 gas')).toBeTruthy();
  });

  it('keeps missing or failed simulations honest while leaving the command available', () => {
    const { rerender } = render(
      <GasEstimatePanel currentCompileResult={result} compiling={false} cliCommand={cliCommand} />,
    );
    expect(gasBox().getByRole('status').textContent).toContain('unavailable');
    expect(screen.queryByText(/\d[\d,]* gas/)).toBeNull();
    rerender(
      <GasEstimatePanel
        currentCompileResult={result}
        compiling={false}
        cliCommand={cliCommand}
        deploymentEstimate={{ status: 'error', error: 'Diamond reverted.' }}
      />,
    );
    expect(gasBox().getByRole('alert').textContent).toContain('Diamond reverted');
    expect(screen.getByLabelText('Compose command').textContent?.replace(/\n  /g, ' ')).toBe(
      cliCommand,
    );
  });

  it.each(['', '-5', 'NaN', 'Infinity', '1.5', '0x10', '123 gas', 123, null])(
    'rejects malformed simulated gas %s',
    (total) => {
      render(
        <GasEstimatePanel
          currentCompileResult={result}
          compiling={false}
          cliCommand={cliCommand}
          deploymentEstimate={{
            status: 'ready',
            result: { ...simulated, totalGasSpent: total as typeof simulated.totalGasSpent },
          }}
        />,
      );
      expect(gasBox().getByRole('alert').textContent).toContain('invalid gas');
    },
  );

  it('hides old gas for compiler invalidation, errors, and pending simulation', () => {
    const ready = { status: 'ready' as const, result: simulated };
    const { rerender } = render(
      <GasEstimatePanel
        currentCompileResult={result}
        compiling={false}
        cliCommand={cliCommand}
        deploymentEstimate={ready}
      />,
    );
    expect(screen.getByText('424,242 gas')).toBeTruthy();
    rerender(
      <GasEstimatePanel
        currentCompileResult={result}
        compiling
        cliCommand={cliCommand}
        deploymentEstimate={ready}
      />,
    );
    expect(gasBox().getByRole('status').textContent).toContain('Compiling');
    expect(screen.queryByText('424,242 gas')).toBeNull();
    rerender(
      <GasEstimatePanel
        currentCompileResult={result}
        compiling={false}
        cliCommand={cliCommand}
        deploymentEstimate={{ status: 'loading' }}
      />,
    );
    expect(gasBox().getByRole('status').textContent).toContain('Simulating');
    rerender(
      <GasEstimatePanel
        currentCompileResult={result}
        compiling={false}
        currentCompileError="Timed out"
        cliCommand={cliCommand}
        deploymentEstimate={ready}
      />,
    );
    expect(gasBox().getByRole('alert').textContent).toContain('Compiler unavailable');
    expect(screen.queryByText('424,242 gas')).toBeNull();
    rerender(
      <GasEstimatePanel compiling={false} cliCommand={cliCommand} deploymentEstimate={ready} />,
    );
    expect(gasBox().getByRole('status').textContent).toContain('Compile the project');
  });
});

describe('Compose command copy', () => {
  it('copies the exact current command with feedback even when compilation is pending', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<GasEstimatePanel compiling cliCommand={cliCommand} />);
    const copy = screen.getByRole('button', { name: 'Copy Compose command' });
    copy.focus();
    expect(document.activeElement).toBe(copy);
    fireEvent.click(copy);
    await screen.findByText('Copied');
    expect(writeText).toHaveBeenCalledExactlyOnceWith(cliCommand);
    expect(commandBox().getByRole('status').textContent).toBe('Compose command copied.');
  });

  it.each(['denied', 'unavailable'])(
    'provides manual-copy feedback when clipboard is %s',
    async (reason) => {
      const writeText = vi.fn().mockRejectedValue(new Error('Denied'));
      vi.stubGlobal('navigator', reason === 'denied' ? { clipboard: { writeText } } : {});
      render(<GasEstimatePanel compiling={false} cliCommand={cliCommand} />);
      fireEvent.click(screen.getByRole('button', { name: 'Copy Compose command' }));
      expect((await commandBox().findByRole('alert')).textContent).toBe(
        'Copy failed. Select and copy the command manually.',
      );
      expect(screen.getByLabelText('Compose command').textContent).toBe(cliCommand);
      expect(screen.getByLabelText('Compose command').textContent?.replace(/\n  /g, ' ')).toBe(
        cliCommand,
      );
      expect(
        screen.getByRole('button', { name: 'Copy Compose command' }).hasAttribute('disabled'),
      ).toBe(false);
      expect(screen.queryByText('Copied')).toBeNull();
    },
  );

  it('clears previous feedback and copies the latest command after config changes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { rerender } = render(<GasEstimatePanel compiling={false} cliCommand={cliCommand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Compose command' }));
    await screen.findByText('Copied');
    const nextCommand = cliCommand
      .replace('my-diamond', 'new-project')
      .replace('foundry', 'hardhat');
    rerender(<GasEstimatePanel compiling={false} cliCommand={nextCommand} />);
    expect(screen.queryByText('Copied')).toBeNull();
    expect(screen.getByLabelText('Compose command').textContent?.replace(/\n  /g, ' ')).toBe(
      nextCommand,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy Compose command' }));
    await screen.findByText('Copied');
    expect(writeText).toHaveBeenLastCalledWith(nextCommand);
  });

  it('does not attribute a delayed old-command copy to a newer configuration', async () => {
    let finishCopy!: () => void;
    const pendingCopy = new Promise<void>((resolve) => {
      finishCopy = resolve;
    });
    const writeText = vi.fn().mockReturnValueOnce(pendingCopy).mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { rerender } = render(<GasEstimatePanel compiling={false} cliCommand={cliCommand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Compose command' }));
    expect(
      screen.getByRole('button', { name: 'Copy Compose command' }).hasAttribute('disabled'),
    ).toBe(true);
    const nextCommand = cliCommand.replace('my-diamond', 'updated-diamond');
    rerender(<GasEstimatePanel compiling={false} cliCommand={nextCommand} />);
    await act(async () => {
      finishCopy();
      await pendingCopy;
    });
    expect(screen.queryByText('Copied')).toBeNull();
    expect(commandBox().getByRole('status').textContent).toBe('');
    expect(screen.getByLabelText('Compose command').textContent?.replace(/\n  /g, ' ')).toBe(
      nextCommand,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy Compose command' }));
    await screen.findByText('Copied');
    expect(writeText).toHaveBeenLastCalledWith(nextCommand);
  });
});

it('shows a static terminal preview with separated options and an excluded prompt', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  const command = 'npx compose init --name "A --not-an-option" --yes --base counter';
  const { container } = render(<GasEstimatePanel compiling={false} cliCommand={command} />);
  const code = screen.getByLabelText('Compose command');
  expect(code.textContent).toBe(
    'npx compose init\n  --name "A --not-an-option"\n  --yes\n  --base counter',
  );
  const prompt = screen.getByText('$');
  expect(prompt.getAttribute('aria-hidden')).toBe('true');
  expect(prompt.classList.contains('select-none')).toBe(true);
  expect(code.parentElement!.getAttribute('tabindex')).toBe('0');
  expect(code.classList.contains('cursor-default')).toBe(true);
  expect(code.classList.contains('caret-transparent')).toBe(true);
  expect(container.querySelector('input, textarea, [contenteditable="true"]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Copy Compose command' }));
  await screen.findByText('Copied');
  expect(writeText).toHaveBeenCalledWith(command);
  expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('$'));
});

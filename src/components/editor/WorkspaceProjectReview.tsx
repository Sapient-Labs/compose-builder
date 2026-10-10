import { useEffect, useId, useMemo, useState } from 'react';
import type { DeploymentEstimateState } from './useDeploymentEstimate';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Fuel,
  Loader2,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DEFAULT_GAS_PRICE_GWEI,
  gasUnitsForMode,
  parseGasUnits,
  previewFeeForGas,
  type DeploymentMode,
} from '@/lib/compose-core/feePreview';
import { useLiveFeeMarket, type LiveFeeMarket } from './useLiveFeeMarket';
import type {
  DiamondCompileResult,
  SelectorEntry,
  StorageEntry,
} from '@/lib/compose-core/compiler';

export type ProjectReviewProps = {
  currentCompileResult?: DiamondCompileResult;
  compiling: boolean;
  currentCompileError?: string;
};

/** Keep this component mounted when leaving Project mode to retain its active tab. */
export function ProjectDataPanel(props: ProjectReviewProps) {
  const [tab, setTab] = useState('selectors');
  const { currentCompileResult, compiling, currentCompileError } = props;
  const ready =
    !compiling &&
    !currentCompileError &&
    !!currentCompileResult &&
    !currentCompileResult.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
  const selectors = ready ? currentCompileResult.validation.selectors : [];
  const storage = ready ? currentCompileResult.validation.storage : [];

  return (
    <Tabs value={tab} onValueChange={setTab} className="h-full min-h-0 gap-0">
      <div className="workspace-pane-header min-w-0 gap-2 border-b bg-muted/25 px-3">
        <TabsList aria-label="Project data">
          <TabsTrigger value="selectors">
            Selectors{ready && <span className="ml-1 tabular-nums">{selectors.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="storage">
            Storage{ready && <span className="ml-1 tabular-nums">{storage.length}</span>}
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!ready ? (
          <CompileState {...props} subject="project data" />
        ) : (
          <>
            <ReviewMessages result={currentCompileResult} />
            <TabsContent value="selectors" className="m-0 space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Function selectors</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Exported functions in the selected facets. Selector collisions are highlighted.
                </p>
              </div>
              {selectors.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm" aria-label="Exported function selectors">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-3 py-2 font-medium">Selector</th>
                        <th className="px-3 py-2 font-medium">Signature</th>
                        <th className="px-3 py-2 font-medium">Facet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectors.map((entry) => (
                        <SelectorRow
                          key={`${entry.facet}-${entry.signature}-${entry.selector}`}
                          entry={entry}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No selectors available for this project.
                </p>
              )}
            </TabsContent>
            <TabsContent value="storage" className="m-0 space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Storage positions</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Named storage positions declared in selected facet source. This is not a full
                  compiler storage layout.
                </p>
              </div>
              {storage.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm" aria-label="Storage slots">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-3 py-2 font-medium">Label</th>
                        <th className="px-3 py-2 font-medium">Constant</th>
                        <th className="px-3 py-2 font-medium">Facets</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storage.map((entry) => (
                        <StorageRow key={entry.label} entry={entry} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No storage positions declared in selected facets.
                </p>
              )}
            </TabsContent>
          </>
        )}
      </div>
    </Tabs>
  );
}

export function GasEstimatePanel(
  props: ProjectReviewProps & { cliCommand: string; deploymentEstimate?: DeploymentEstimateState },
) {
  // Live pricing only matters once a simulation is ready; the hook never fires in Builder.
  const liveMarket = useLiveFeeMarket(props.deploymentEstimate?.status === 'ready');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="workspace-pane-header gap-2 border-b bg-muted/25 px-3 text-xs font-medium">
        <h2>Project summary</h2>
      </div>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        <section
          className="min-w-0 shrink-0 space-y-3 rounded-lg border p-3"
          aria-label="Deployment gas estimate"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Fuel className="size-4 text-muted-foreground" aria-hidden="true" />
            Gas estimate
          </h3>
          <DeploymentGasEstimate {...props} liveMarket={liveMarket} />
        </section>
        <ComposeCommandBox key={props.cliCommand} command={props.cliCommand} />
      </div>
    </div>
  );
}

function DeploymentGasEstimate({
  currentCompileResult,
  compiling,
  currentCompileError,
  deploymentEstimate,
  liveMarket,
}: ProjectReviewProps & {
  deploymentEstimate?: DeploymentEstimateState;
  liveMarket: LiveFeeMarket;
}) {
  if (compiling)
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Compiling gas estimate…
      </p>
    );
  if (
    currentCompileError ||
    currentCompileResult?.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  ) {
    return (
      <p className="text-xs text-destructive" role="alert">
        {currentCompileError ? 'Compiler unavailable.' : 'Compilation failed.'} Gas estimate
        unavailable.
      </p>
    );
  }
  if (!currentCompileResult) {
    return (
      <p className="text-xs text-muted-foreground" role="status">
        Compile the project to estimate deployment gas.
      </p>
    );
  }

  if (deploymentEstimate?.status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Simulating deployment…
      </p>
    );
  }
  if (deploymentEstimate?.status === 'error') {
    return (
      <p className="text-xs text-destructive" role="alert">
        Simulation unavailable. {deploymentEstimate.error}
      </p>
    );
  }
  if (deploymentEstimate?.status !== 'ready') {
    return (
      <p className="text-xs text-muted-foreground" role="status">
        {currentCompileResult.deploymentArtifactsError ||
          'Local deployment simulation is unavailable for this compiled project.'}
      </p>
    );
  }
  const simulation = deploymentEstimate.result;
  if (
    typeof simulation.totalGasSpent !== 'string' ||
    !/^\d+$/.test(simulation.totalGasSpent) ||
    simulation.fork !== 'paris'
  ) {
    return (
      <p className="text-xs text-destructive" role="alert">
        Simulation returned an invalid gas result.
      </p>
    );
  }
  return <SimulatedDeploymentCost simulation={simulation} liveMarket={liveMarket} />;
}

function SimulatedDeploymentCost({
  simulation,
  liveMarket,
}: {
  simulation: Extract<DeploymentEstimateState, { status: 'ready' }>['result'];
  liveMarket: LiveFeeMarket;
}) {
  const [mode, setMode] = useState<DeploymentMode>('fresh');
  const [gasPriceGwei, setGasPriceGwei] = useState(DEFAULT_GAS_PRICE_GWEI);
  const [ethPriceUsd, setEthPriceUsd] = useState('');
  const [gasTouched, setGasTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const gasInputId = useId();
  const priceInputId = useId();

  // Autofill from live market until the user takes over an input.
  useEffect(() => {
    if (liveMarket.status === 'live' && !gasTouched && liveMarket.gasPriceGwei)
      setGasPriceGwei(liveMarket.gasPriceGwei);
  }, [liveMarket.status, liveMarket.gasPriceGwei, gasTouched]);
  useEffect(() => {
    if (liveMarket.status === 'live' && !priceTouched && liveMarket.ethPriceUsd)
      setEthPriceUsd(liveMarket.ethPriceUsd);
  }, [liveMarket.status, liveMarket.ethPriceUsd, priceTouched]);

  const costs = useMemo(() => {
    const diamond = parseGasUnits(simulation.totalGasSpent);
    // Older estimates may lack the breakdown; degrade to Diamond-only rather than failing.
    const breakdown = Array.isArray(simulation.facetDeployments) ? simulation.facetDeployments : [];
    const facetsTotal =
      parseGasUnits(simulation.facetsTotalGasSpent ?? '') ??
      breakdown.reduce<bigint | null>((sum, entry) => {
        const units = parseGasUnits(entry.totalGasSpent);
        if (units === null) return null;
        return (sum ?? 0n) + units;
      }, 0n);
    const fullTotal =
      parseGasUnits(simulation.fullTotalGasSpent ?? '') ??
      (diamond !== null && facetsTotal !== null ? diamond + facetsTotal : null);
    const billed = gasUnitsForMode(diamond, facetsTotal, fullTotal, mode);
    return { diamond, breakdown, facetsTotal, fullTotal, billed };
  }, [simulation, mode]);

  const freshPreview = useMemo(
    () =>
      previewFeeForGas(
        gasUnitsForMode(costs.diamond, costs.facetsTotal, costs.fullTotal, 'fresh'),
        gasPriceGwei,
        ethPriceUsd,
      ),
    [costs, gasPriceGwei, ethPriceUsd],
  );
  const registryPreview = useMemo(
    () =>
      previewFeeForGas(
        gasUnitsForMode(costs.diamond, costs.facetsTotal, costs.fullTotal, 'registry'),
        gasPriceGwei,
        ethPriceUsd,
      ),
    [costs, gasPriceGwei, ethPriceUsd],
  );
  const billedPreview = mode === 'fresh' ? freshPreview : registryPreview;
  if (costs.diamond === null || costs.billed === null) {
    return (
      <p className="text-xs text-destructive" role="alert">
        Simulation returned an invalid gas result.
      </p>
    );
  }

  const hasBreakdown = costs.breakdown.length > 0 && costs.facetsTotal !== null;
  return (
    <div className="space-y-2">
      <div
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1"
        role="radiogroup"
        aria-label="Deployment assumption"
      >
        <label
          title="Deploy every facet, then the Diamond"
          className={`cursor-pointer rounded-md px-2 py-1 text-center text-xs font-medium ${mode === 'fresh' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <input
            type="radio"
            name="deployment-mode"
            className="sr-only"
            checked={mode === 'fresh'}
            onChange={() => setMode('fresh')}
          />
          New facets
        </label>
        <label
          title="Facets already deployed, Diamond only"
          className={`cursor-pointer rounded-md px-2 py-1 text-center text-xs font-medium ${mode === 'registry' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <input
            type="radio"
            name="deployment-mode"
            className="sr-only"
            checked={mode === 'registry'}
            onChange={() => setMode('registry')}
          />
          Predeployed facets
        </label>
      </div>

      <dl className="space-y-1 text-xs">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Diamond deployment</dt>
          <dd className="font-medium tabular-nums">{costs.diamond.toLocaleString('en-US')} gas</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-t pt-1.5">
          <dt className="font-medium">{mode === 'fresh' ? 'Full deployment' : 'Diamond only'}</dt>
          <dd className="text-sm font-semibold tabular-nums">
            {costs.billed.toLocaleString('en-US')} gas
          </dd>
        </div>
      </dl>

      {billedPreview ? (
        <p className="text-lg font-semibold tabular-nums">
          {billedPreview.feeUsdc}{' '}
          <span className="text-xs font-normal text-muted-foreground">
            USDC ≈ {billedPreview.feeEth} ETH
          </span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground" role="status">
          <button
            type="button"
            className="cursor-pointer underline underline-offset-2"
            onClick={() => setDetailsOpen(true)}
          >
            Set gas and ETH prices in Breakdown & pricing
          </button>{' '}
          to preview the fee in USDC.
        </p>
      )}

      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="border-t pt-1">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          Breakdown & pricing
          <ChevronRight
            className={cn('size-4 transition-transform', detailsOpen && 'rotate-90')}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pb-1">
          {hasBreakdown && (
            <dl className="space-y-1 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">
                  Facets deployment ({costs.breakdown.length})
                </dt>
                <dd className="font-medium tabular-nums">
                  {costs.facetsTotal!.toLocaleString('en-US')} gas
                </dd>
              </div>
            </dl>
          )}
          {hasBreakdown && (
            <ul className="space-y-0.5 rounded-md bg-muted/30 px-2 py-1 text-xs">
              {costs.breakdown.map((entry) => (
                <li key={entry.name} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-mono text-[11px]">{entry.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {BigInt(entry.totalGasSpent).toLocaleString('en-US')} gas
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-medium">Pricing</h4>
            <span className="flex items-center gap-1">
              {liveMarket.status === 'live' ? (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
                  Live mainnet pricing
                </span>
              ) : liveMarket.status === 'loading' ? (
                <span
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  role="status"
                >
                  <Loader2
                    className="size-3 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Fetching…
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Enter manually</span>
              )}
              <button
                type="button"
                title="Refresh live pricing"
                aria-label="Refresh live pricing"
                className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                onClick={() => {
                  liveMarket.refresh();
                  setGasTouched(false);
                  setPriceTouched(false);
                }}
                disabled={liveMarket.status === 'loading'}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <label htmlFor={gasInputId}>Gas</label>
            <Input
              id={gasInputId}
              inputMode="decimal"
              autoComplete="off"
              className="h-7 w-20 px-2 tabular-nums"
              value={gasPriceGwei}
              onChange={(event) => {
                setGasPriceGwei(event.target.value);
                setGasTouched(true);
              }}
            />
            <span aria-hidden="true">Gwei · ETH $</span>
            <Input
              id={priceInputId}
              aria-label="ETH price in USD, approximately USDC"
              inputMode="decimal"
              autoComplete="off"
              className="h-7 w-24 px-2 tabular-nums"
              placeholder="2487.45"
              value={ethPriceUsd}
              onChange={(event) => {
                setEthPriceUsd(event.target.value);
                setPriceTouched(true);
              }}
            />
          </p>
          {billedPreview && (
            <div className="space-y-0.5 text-[11px] tabular-nums text-muted-foreground">
              <p className="overflow-x-auto whitespace-nowrap">
                {billedPreview.gasUnits.toLocaleString('en-US')} gas × {gasPriceGwei.trim()} Gwei ×
                ${ethPriceUsd.trim()} = {billedPreview.feeUsdc} USDC
              </p>
              <p title="Gas comes from a local Paris EVM with deterministic addresses and the current sample initialization. Pricing uses mainnet ETH/USD; L2s and testnets differ. Not a gas limit or fee quote.">
                <span className="whitespace-nowrap">≈ {billedPreview.feeEth} ETH</span>
                {' · '}
                <a
                  href="https://etherscan.io/gastracker"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  Etherscan
                </a>
              </p>
            </div>
          )}
          {liveMarket.error && (
            <p className="text-[11px] text-muted-foreground">
              {liveMarket.error} You can still enter values manually.
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** Presentation only: preserve quoted/escaped values, never change the copied command. */
function formatCommandPreview(command: string) {
  let formatted = '';
  let quote = '';
  for (let index = 0; index < command.length; index++) {
    const char = command[index];
    if (char === '\\' && quote !== "'") {
      formatted += char + (command[++index] ?? '');
      continue;
    }
    if (char === "'" || char === '"') {
      if (!quote) quote = char;
      else if (quote === char) quote = '';
    }
    if (!quote && char === ' ' && /^--[a-z][a-z-]*(?:\s|=|$)/i.test(command.slice(index + 1))) {
      formatted += '\n  ';
    } else formatted += char;
  }
  return formatted;
}

function ComposeCommandBox({ command }: { command: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  useEffect(() => {
    if (copyState !== 'copied') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const copyCommand = async () => {
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(command);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <section
      className="min-w-0 shrink-0 overflow-hidden rounded-lg border border-[#263142] bg-[#0b0e14] text-[#e0e7f0]"
      aria-label="Compose CLI command"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#263142] bg-[#141a24] px-3 py-2">
        <h3 className="flex items-center gap-2 font-mono text-xs font-medium">
          <Terminal className="size-3.5 text-slate-400" aria-hidden="true" />
          Compose command
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-slate-300 hover:bg-[#253044] hover:text-white focus-visible:ring-slate-400"
          onClick={copyCommand}
          disabled={copyState === 'copying'}
          aria-label="Copy Compose command"
          title="Copy the runnable command as one line"
        >
          {copyState === 'copied' ? (
            <Check className="size-3" aria-hidden="true" />
          ) : (
            <Copy className="size-3" aria-hidden="true" />
          )}
          {copyState === 'copied' ? 'Copied' : copyState === 'copying' ? 'Copying…' : 'Copy'}
        </Button>
      </div>
      <div className="flex min-w-0 items-start gap-3 px-3 py-3 font-mono text-xs leading-relaxed">
        <span aria-hidden="true" className="shrink-0 cursor-default select-none text-emerald-300">
          $
        </span>
        <pre
          tabIndex={0}
          aria-label="Command preview"
          className="min-w-0 flex-1 max-h-40 cursor-default caret-transparent overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-slate-400 [overflow-wrap:anywhere]"
        >
          <code aria-label="Compose command" className="cursor-default caret-transparent">
            {copyState === 'error' ? command : formatCommandPreview(command)}
          </code>
        </pre>
      </div>
      <p className="px-3 pb-2 text-[10px] text-slate-400">Copy returns one runnable line.</p>
      {copyState === 'error' ? (
        <p className="px-3 pb-3 text-xs text-rose-300" role="alert">
          Copy failed. Select and copy the command manually.
        </p>
      ) : (
        <span className="sr-only" role="status" aria-live="polite">
          {copyState === 'copied' ? 'Compose command copied.' : ''}
        </span>
      )}
    </section>
  );
}

function CompileState({
  currentCompileResult,
  compiling,
  currentCompileError,
  subject,
}: ProjectReviewProps & { subject: string }) {
  if (compiling)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Compiling {subject}…
      </div>
    );
  const errors =
    currentCompileResult?.diagnostics.filter((diagnostic) => diagnostic.severity === 'error') ?? [];
  if (currentCompileError || errors.length)
    return (
      <div className="space-y-2" role="alert">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          {currentCompileError ? 'Compiler unavailable' : 'Compilation failed'}
        </h3>
        <p className="text-xs text-muted-foreground">
          Current {subject} cannot be shown until compilation succeeds.
        </p>
        {currentCompileError && (
          <p className="break-words text-sm text-destructive">{currentCompileError}</p>
        )}
        {errors.map((diagnostic, index) => (
          <pre key={index} className="whitespace-pre-wrap break-words text-xs text-destructive">
            {diagnostic.message}
          </pre>
        ))}
      </div>
    );
  return (
    <p className="text-sm text-muted-foreground" role="status">
      Compile the project to see {subject}.
    </p>
  );
}

function ReviewMessages({ result }: { result: DiamondCompileResult }) {
  const messages = result.validation.messages;
  const diagnostics = result.diagnostics.filter((diagnostic) => diagnostic.severity !== 'error');
  if (!messages.length && !diagnostics.length) return null;
  return (
    <div className="mb-4 space-y-2">
      {messages.length > 0 && (
        <ul
          className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {diagnostics.length > 0 && (
        <details className="rounded-lg border p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Compiler diagnostics ({diagnostics.length})</summary>
          {diagnostics.map((diagnostic, index) => (
            <pre key={index} className="mt-2 whitespace-pre-wrap break-words">
              {diagnostic.message}
            </pre>
          ))}
        </details>
      )}
    </div>
  );
}

// Shared with classic Inspect. Its row presentation stays unchanged.
export function SelectorRow({ entry }: { entry: SelectorEntry }) {
  return (
    <tr className={`border-b last:border-b-0 ${entry.collision ? 'bg-destructive/10' : ''}`}>
      <td className="px-3 py-2 font-mono text-xs">{entry.selector}</td>
      <td className="px-3 py-2">{entry.signature}</td>
      <td
        className={`px-3 py-2 ${entry.collision ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
      >
        {entry.facet}
        {entry.collision && <span className="ml-2 text-xs">collision</span>}
      </td>
    </tr>
  );
}

export function StorageRow({ entry }: { entry: StorageEntry }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2 font-medium">{entry.label}</td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
        keccak256("{entry.label}")
        <span className="block text-[10px] opacity-70">{entry.constant}</span>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{entry.facets.join(', ')}</td>
    </tr>
  );
}

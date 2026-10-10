import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Terminal, X } from 'lucide-react';
import { useLaunchpadStore } from '@/lib/state/store';
import { buildCliCommand, planComposition } from '@/lib/compose-core';
import { DEFAULT_PROJECT_NAME } from '@/lib/state/workspace';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/ui/code-block';

export function ContinueLocallyDialog() {
  const { catalog, activeProject, updateProject } = useLaunchpadStore();
  const [projectName, setProjectName] = useState(activeProject?.name ?? '');
  const config = activeProject?.config;

  useEffect(() => {
    setProjectName(activeProject?.name ?? '');
  }, [activeProject?.id, activeProject?.name]);

  const saveProjectName = () => {
    const name = projectName.trim() || DEFAULT_PROJECT_NAME;
    setProjectName(name);
    if (name !== activeProject?.name) updateProject({ name });
  };
  const plan = useMemo(
    () => (catalog && config ? planComposition(catalog, config) : null),
    [catalog, config],
  );
  const command = config ? buildCliCommand(config, projectName || DEFAULT_PROJECT_NAME) : '';

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          variant="default"
          size="sm"
          disabled={!config || !plan}
          className="h-8 gap-1.5 px-3 text-xs shadow-sm"
        >
          <Terminal className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Export to your terminal</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">Export your project</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Scaffold this Compose project in any terminal.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close dialog">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          {plan && config && (
            <>
              <div className="mt-5 space-y-2 text-sm">
                <div className="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
                  <label
                    htmlFor="continue-locally-project-name"
                    className="text-[10px] uppercase tracking-wide text-muted-foreground"
                  >
                    Project name
                  </label>
                  <input
                    id="continue-locally-project-name"
                    value={projectName}
                    maxLength={100}
                    onChange={(event) => setProjectName(event.target.value)}
                    onBlur={saveProjectName}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                    }}
                    className="mt-1 block w-full min-w-0 truncate bg-transparent font-medium outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                    placeholder="Name your project"
                    aria-describedby="project-name-hint"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {config.baseKey === 'none' ? 'Blank project' : plan.base.label} ·{' '}
                  {config.framework === 'foundry'
                    ? 'Foundry'
                    : `Hardhat · ${config.toolbox ?? 'ethers'}`}
                </p>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium">Run this command</p>
                <CodeBlock code={command} language="bash" />
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Creates your project structure, Diamond contract, deployment script, tests, and
                configuration.
              </p>
            </>
          )}

          <div className="mt-6 flex justify-end">
            <Dialog.Close asChild>
              <Button variant="outline">Close</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

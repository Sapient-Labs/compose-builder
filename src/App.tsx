import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { useLaunchpadStore } from '@/lib/state/store';
import { loadBasesCatalog } from '@/lib/compose-core';
import { PreviewArea } from '@/components/editor/PreviewArea';
import { ContinueLocallyDialog } from '@/components/editor/ContinueLocallyDialog';
import { OpenInRemixButton } from '@/components/editor/OpenInRemixButton';
import { NavbarGradient } from '@/components/navigation/NavbarGradient';
import { BookOpen, Diamond, Moon, Sun } from 'lucide-react';

function App() {
  const { resolvedTheme, setTheme } = useTheme();
  const { catalog, setCatalog, isLoading, setLoading, error, setError } = useLaunchpadStore();

  useEffect(() => {
    if (catalog || isLoading || error) return;

    setLoading(true);
    loadBasesCatalog()
      .then(setCatalog)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [catalog, isLoading, error, setCatalog, setLoading, setError]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Diamond className="size-12 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading catalog...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Error: {error}</p>
          <button onClick={() => window.location.reload()} className="text-primary underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-background flex overflow-hidden">
      <Toaster position="bottom-right" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="app-navbar h-11 flex-shrink-0" aria-label="Application toolbar">
          <NavbarGradient />
          <div className="app-navbar-content h-full px-3 sm:px-4 flex items-center justify-end">
            <div className="mr-auto flex items-center gap-2 px-2">
              <img src="/logo.svg" alt="Compose" className="size-5" />
              <span className="hidden sm:inline text-sm font-semibold">Compose Builder</span>
            </div>
            <div className="flex items-center gap-2 origin-right">
              <a
                href="https://compose.diamonds/docs"
                target="_blank"
                rel="noreferrer"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Documentation"
              >
                <BookOpen className="size-4" />
              </a>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
              </button>
              <OpenInRemixButton />
              <ContinueLocallyDialog />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <PreviewArea />
        </main>
      </div>
    </div>
  );
}

export default App;

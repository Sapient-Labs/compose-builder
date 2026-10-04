import { useEffect, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useLaunchpadStore } from "@/lib/state/store";
import { loadBasesCatalog } from "@/lib/compose-core";
import { getPageSnapshot, subscribeToNavigation } from "@/lib/navigation";
import { PreviewArea } from "@/components/editor/PreviewArea";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { ContinueLocallyDialog } from "@/components/editor/ContinueLocallyDialog";
import { BookOpen, Diamond, Moon, Sun, PanelsTopLeft } from "lucide-react";

function App() {
  const page = useSyncExternalStore(subscribeToNavigation, getPageSnapshot, () => "classic");
  const { resolvedTheme, setTheme } = useTheme();
  const { catalog, setCatalog, isLoading, setLoading, error, setError } =
    useLaunchpadStore();

  useEffect(() => {
    if (catalog || isLoading) return;

    setLoading(true);
    loadBasesCatalog()
      .then(setCatalog)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [catalog, isLoading, setCatalog, setLoading, setError]);

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
          <button
            onClick={() => window.location.reload()}
            className="text-primary underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-background flex overflow-hidden">
      {page === "classic" && <EditorSidebar />}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-11 border-b flex-shrink-0" aria-label="Application toolbar">
          <div className="h-full px-3 sm:px-4 flex items-center justify-end">
            <nav aria-label="Page navigation" className="mr-auto flex items-center gap-1 text-xs">
              <a href="#/" aria-label="Launchpad" aria-current={page === "classic" ? "page" : undefined} className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Diamond className="size-4 sm:hidden" /><span className="hidden sm:inline">Launchpad</span></a>
              <a href="#/workspace" aria-label="Workspace" aria-current={page === "workspace" ? "page" : undefined} className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><PanelsTopLeft className="size-4 sm:hidden" /><span className="hidden sm:inline">Workspace</span></a>
            </nav>
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
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
              >
                {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <ContinueLocallyDialog />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          {page === "workspace" ? <PreviewArea presentation="workspace" /> : <EditorLayout />}
        </main>
      </div>
    </div>
  );
}

export default App;

import { useEffect } from "react";
import { useLaunchpadStore } from "@/lib/state/store";
import { loadBasesCatalog } from "@/lib/compose-core";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Diamond } from "lucide-react";

function App() {
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b flex-shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Diamond className="size-6 text-primary" />
            <h1 className="text-xl font-semibold">Compose Launchpad</h1>
          </div>
          <ConnectButton />
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <EditorLayout />
      </main>
    </div>
  );
}

export default App;

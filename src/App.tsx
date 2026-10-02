import { useEffect } from "react";
import { useLaunchpadStore } from "@/lib/state/store";
import { loadBasesCatalog } from "@/lib/compose-core";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
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
    <div className="h-screen bg-background flex overflow-hidden">
      <EditorSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-11 border-b flex-shrink-0">
          <div className="h-full px-4 flex items-center justify-end">
            <div className="origin-right [&_button]:!h-8 [&_button]:!text-sm [&_button]:!rounded-md [&_button]:!px-3">
              <ConnectButton
                showBalance={false}
                chainStatus="icon"
                accountStatus="address"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <EditorLayout />
        </main>
      </div>
    </div>
  );
}

export default App;

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLaunchpadStore } from "@/lib/state/store";
import { buildRemixUrl, collectProjectFiles, createGistViaProxy } from "@/lib/compose-core";
import { Button } from "@/components/ui/button";

function RemixLogo({ className }: { className?: string }) {
  return (
    <img
      src="/remix-logo-blue.webp"
      alt=""
      className={className}
      aria-hidden="true"
    />
  );
}

export function OpenInRemixButton() {
  const { catalog, activeProject } = useLaunchpadStore();
  const config = activeProject?.config;
  const [loading, setLoading] = useState(false);

  const handleOpenInRemix = async () => {
    if (!catalog || !config) return;
    setLoading(true);
    try {
      const files = await collectProjectFiles(catalog, config);
      const { gistId } = await createGistViaProxy(files, config);
      window.open(buildRemixUrl(gistId), "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open in Remix.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!config || loading}
      onClick={handleOpenInRemix}
      className="h-8 gap-1.5 px-3 text-xs shadow-sm"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <RemixLogo className="size-4" />
      )}
      <span className="hidden sm:inline">{loading ? "Creating…" : "Remix"}</span>
    </Button>
  );
}

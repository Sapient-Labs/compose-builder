import { useLaunchpadStore } from "@/lib/state/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function BaseSelector() {
  const { catalog, config, setConfig } = useLaunchpadStore();

  if (!catalog) return null;

  const features = Object.entries(catalog.features)
    .filter(([, def]) => !def.access && def.visible !== false);

  const handleSelect = (key: string) => {
    setConfig({
      baseKey: key,
      selectedExtensions: [],
      selectedAccess: [],
      selectedAccessExtensions: [],
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Choose Your Base</h2>
        <p className="text-muted-foreground mt-2">
          Select a starting point for your diamond. Each base includes required facets and optional extensions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            config.baseKey === "none" && "ring-2 ring-primary"
          )}
          onClick={() => handleSelect("none")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Blank
              <Badge variant="outline">None</Badge>
            </CardTitle>
            <CardDescription>Start from scratch with no pre-configured facets</CardDescription>
          </CardHeader>
        </Card>

        {features.map(([key, definition]) => (
          <Card
            key={key}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              config.baseKey === key && "ring-2 ring-primary"
            )}
            onClick={() => handleSelect(key)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {definition.label}
                <Badge variant="secondary">{key}</Badge>
              </CardTitle>
              <CardDescription>
                {Object.keys(definition.required).length} required,{" "}
                {Object.keys(definition.optional).length} optional facets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {Object.keys(definition.required).slice(0, 3).map((facet) => (
                  <Badge key={facet} variant="outline" className="text-xs">
                    {facet}
                  </Badge>
                ))}
                {Object.keys(definition.required).length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{Object.keys(definition.required).length - 3} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

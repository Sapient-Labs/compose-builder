import { useLaunchpadStore } from "@/lib/state/store";
import { getAvailableLibraryFacets, EMPTY_BASE } from "@/lib/compose-core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export function LibrarySelector() {
  const { catalog, config, setConfig } = useLaunchpadStore();

  if (!catalog) return null;

  const selectedBase = config.baseKey === "none"
    ? EMPTY_BASE
    : catalog.features[config.baseKey];

  const availableLibraries = Object.entries(
    getAvailableLibraryFacets(catalog, selectedBase)
  );

  const handleToggle = (facetName: string) => {
    const isSelected = config.selectedLibraries.includes(facetName);
    setConfig({
      selectedLibraries: isSelected
        ? config.selectedLibraries.filter((f) => f !== facetName)
        : [...config.selectedLibraries, facetName],
    });
  };

  if (availableLibraries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Compose Libraries</h2>
          <p className="text-muted-foreground mt-2">
            No additional library facets available.
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No library facets available for this configuration. Click Next to continue.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Compose Libraries</h2>
        <p className="text-muted-foreground mt-2">
          Add utility facets like ERC-165 interface detection.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {availableLibraries.map(([name, entry]) => {
          const isSelected = config.selectedLibraries.includes(name);
          const hasErc165 = !!entry.erc165;

          return (
            <Card
              key={name}
              className={`cursor-pointer transition-all ${
                isSelected ? "ring-2 ring-primary" : "hover:shadow-sm"
              }`}
              onClick={() => handleToggle(name)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Checkbox checked={isSelected} />
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {name}
                      {hasErc165 && <Badge variant="outline">ERC-165</Badge>}
                    </CardTitle>
                    <CardDescription>
                      Utility facet from Compose libraries
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

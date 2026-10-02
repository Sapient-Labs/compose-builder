import { useLaunchpadStore } from "@/lib/state/store";
import { resolveCatalogSelection } from "@/lib/compose-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export function FacetSelector() {
  const { catalog, config, setConfig } = useLaunchpadStore();

  if (!catalog) return null;

  const selection = resolveCatalogSelection(
    catalog,
    config.baseKey,
    config.selectedLibraries,
    config.selectedExtensions,
    config.selectedAccess,
    config.selectedAccessExtensions
  );

  const availableExtensions = Object.entries(selection.availableExtensions);

  const handleToggle = (facetName: string) => {
    const isSelected = config.selectedExtensions.includes(facetName);
    setConfig({
      selectedExtensions: isSelected
        ? config.selectedExtensions.filter((f) => f !== facetName)
        : [...config.selectedExtensions, facetName],
    });
  };

  if (availableExtensions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Extension Facets</h2>
          <p className="text-muted-foreground mt-2">
            No optional extensions available for this base.
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            The selected base has no optional facets. Click Next to continue.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Extension Facets</h2>
        <p className="text-muted-foreground mt-2">
          Select optional facets to extend your diamond's functionality.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {availableExtensions.map(([name, entry]) => {
          const isSelected = config.selectedExtensions.includes(name);
          const hasConstructor = entry.constructor && entry.constructor.length > 0;
          const hasErc165 = !!entry.erc165;

          return (
            <Card
              key={name}
              className={`cursor-pointer transition-all ${
                isSelected ? "ring-2 ring-primary" : "hover:shadow-sm"
              }`}
              onClick={() => handleToggle(name)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isSelected} />
                    <div>
                      <CardTitle className="text-base">{name}</CardTitle>
                      <div className="flex gap-1 mt-1">
                        {hasConstructor && <Badge variant="secondary">Init</Badge>}
                        {hasErc165 && <Badge variant="outline">ERC-165</Badge>}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              {entry.constructor && entry.constructor.length > 0 && entry.constructor[0] && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    {entry.constructor[0]?.comments?.[0] ?? "Requires initialization"}
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

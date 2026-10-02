import { useLaunchpadStore } from "@/lib/state/store";
import { getAccessBases } from "@/lib/compose-core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Shield, User, Users } from "lucide-react";

export function AccessSelector() {
  const { catalog, config, setConfig } = useLaunchpadStore();

  if (!catalog) return null;

  const accessBases = Object.entries(getAccessBases(catalog, config.baseKey));

  const ownershipBases = accessBases.filter(
    ([, def]) => def.accessType === "ownership"
  );
  const roleBases = accessBases.filter(
    ([, def]) => def.accessType === "roles" || !def.accessType
  );

  const handleSelect = (key: string) => {
    const isSelected = config.selectedAccess.includes(key);
    setConfig({
      selectedAccess: isSelected
        ? config.selectedAccess.filter((a) => a !== key)
        : [...config.selectedAccess, key],
      selectedAccessExtensions: [],
    });
  };

  if (accessBases.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Access Control</h2>
          <p className="text-muted-foreground mt-2">
            No access control options available for this base.
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No access control layers available. Click Next to continue.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Access Control</h2>
        <p className="text-muted-foreground mt-2">
          Choose how to control access to your diamond's functions.
        </p>
      </div>

      {ownershipBases.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <User className="size-4" />
            Ownership
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {ownershipBases.map(([key, definition]) => {
              const isSelected = config.selectedAccess.includes(key);
              return (
                <Card
                  key={key}
                  className={cn(
                    "cursor-pointer transition-all",
                    isSelected ? "ring-2 ring-primary" : "hover:shadow-sm"
                  )}
                  onClick={() => handleSelect(key)}
                >
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="size-4" />
                      {definition.label}
                      <Badge variant="secondary">{key}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Single owner controls all privileged functions
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {roleBases.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="size-4" />
            Role-Based Access
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {roleBases.map(([key, definition]) => {
              const isSelected = config.selectedAccess.includes(key);
              return (
                <Card
                  key={key}
                  className={cn(
                    "cursor-pointer transition-all",
                    isSelected ? "ring-2 ring-primary" : "hover:shadow-sm"
                  )}
                  onClick={() => handleSelect(key)}
                >
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="size-4" />
                      {definition.label}
                      <Badge variant="secondary">{key}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Granular role-based permissions
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

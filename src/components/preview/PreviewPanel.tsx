import { useLaunchpadStore } from "@/lib/state/store";
import { resolveCatalogSelection } from "@/lib/compose-core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Diamond, Code, Terminal, Gem } from "lucide-react";
import { DiamondGraph } from "@/components/graph/DiamondGraph";

export function PreviewPanel() {
  const { catalog, config } = useLaunchpadStore();

  if (!catalog) return null;

  const selection = resolveCatalogSelection(
    catalog,
    config.baseKey,
    config.selectedLibraries,
    config.selectedExtensions,
    config.selectedAccess,
    config.selectedAccessExtensions
  );

  const allFacets = [
    ...Object.keys(selection.requiredFacets),
    ...config.selectedExtensions,
    ...config.selectedLibraries,
  ];

  const cliCommand = buildCliCommand(config);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Preview Your Diamond</h2>
        <p className="text-muted-foreground mt-2">
          Review your configuration and generate the project.
        </p>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">
            <Diamond aria-hidden="true" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="code">
            <Code aria-hidden="true" />
            Diamond.sol
          </TabsTrigger>
          <TabsTrigger value="graph">
            <Gem aria-hidden="true" />
            Graph
          </TabsTrigger>
          <TabsTrigger value="cli">
            <Terminal aria-hidden="true" />
            CLI Command
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                {config.projectName} &middot; {config.framework}
                {config.framework === "hardhat" && config.toolbox && ` (${config.toolbox})`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Base</p>
                <Badge variant="secondary" className="mt-1">
                  {selection.selectedBase.label}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium">Facets ({allFacets.length})</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {allFacets.map((facet) => (
                    <Badge key={facet} variant="outline">
                      {facet}
                    </Badge>
                  ))}
                </div>
              </div>

              {config.selectedAccess.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Access Control</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {config.selectedAccess.map((access) => (
                      <Badge key={access} variant="outline">
                        {access}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="code">
          <Card>
            <CardHeader>
              <CardTitle>Diamond.sol</CardTitle>
              <CardDescription>
                Generated Solidity contract (preview)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                <code>{generateDiamondPreview(selection, config)}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph" className="min-h-[420px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Diamond Graph</CardTitle>
              <CardDescription>
                3D visual of the selected diamond composition
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[420px] p-0">
              <DiamondGraph className="h-full" showHeader={false} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cli">
          <Card>
            <CardHeader>
              <CardTitle>CLI Command</CardTitle>
              <CardDescription>
                Run this command to scaffold your project locally
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                <code>{cliCommand}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function buildCliCommand(
  config: { baseKey: string; framework: string; toolbox?: string; selectedLibraries: string[]; selectedExtensions: string[]; selectedAccess: string[]; selectedAccessExtensions: string[] }
): string {
  const parts = ["compose", "init", "--yes"];

  parts.push(`--base ${config.baseKey}`);
  parts.push(`--framework ${config.framework}`);

  if (config.framework === "hardhat" && config.toolbox) {
    parts.push(`--toolbox ${config.toolbox}`);
  }

  if (config.selectedLibraries.length > 0) {
    parts.push(`--libraries ${config.selectedLibraries.join(",")}`);
  }

  if (config.selectedExtensions.length > 0) {
    parts.push(`--extensions ${config.selectedExtensions.join(",")}`);
  }

  const ownership = config.selectedAccess.filter((a) =>
    ["owner", "ownable"].includes(a)
  );
  const roleAccess = config.selectedAccess.filter(
    (a) => !["owner", "ownable"].includes(a)
  );

  if (ownership.length > 0) {
    parts.push(`--ownership ${ownership[0]}`);
  }

  if (roleAccess.length > 0) {
    parts.push(`--access-control ${roleAccess.join(",")}`);
  }

  if (config.selectedAccessExtensions.length > 0) {
    parts.push(`--access-control-extensions ${config.selectedAccessExtensions.join(",")}`);
  }

  return parts.join(" \\\n  ");
}

function generateDiamondPreview(
  selection: ReturnType<typeof resolveCatalogSelection>,
  config: { framework: string; selectedExtensions: string[]; selectedLibraries: string[] }
): string {
  const facets = [
    ...Object.keys(selection.requiredFacets),
    ...config.selectedExtensions,
    ...config.selectedLibraries,
  ];

  return `// SPDX-License-Identifier: MIT
pragma solidity >=0.8.30;

import "@perfect-abstractions/compose/diamond/DiamondMod.sol";
${facets.map((f) => `// ${f}`).join("\n")}

contract Diamond {
    constructor(address[] memory _facets) {
        DiamondMod.addFacets(_facets);
        // ... facet initialization
    }

    fallback() external payable {
        DiamondMod.diamondFallback();
    }

    receive() external payable {}
}`;
}

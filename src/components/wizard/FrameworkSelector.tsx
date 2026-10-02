import { useLaunchpadStore } from "@/lib/state/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Framework } from "@/types/config";
import { Hammer, Pickaxe } from "lucide-react";

const FRAMEWORKS: { key: Framework; label: string; description: string; icon: typeof Hammer }[] = [
  {
    key: "foundry",
    label: "Foundry",
    description: "Fast, portable, and modular toolkit for Ethereum. Written in Rust.",
    icon: Hammer,
  },
  {
    key: "hardhat",
    label: "Hardhat",
    description: "Flexible, extensible, and fast development environment.",
    icon: Pickaxe,
  },
];

export function FrameworkSelector() {
  const { config, setConfig } = useLaunchpadStore();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Choose Framework</h2>
        <p className="text-muted-foreground mt-2">
          Select your preferred Solidity development framework.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
        {FRAMEWORKS.map(({ key, label, description, icon: Icon }) => (
          <Card
            key={key}
            className={cn(
              "cursor-pointer transition-all",
              config.framework === key ? "ring-2 ring-primary" : "hover:shadow-sm"
            )}
            onClick={() => setConfig({ framework: key })}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  config.framework === key ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <Icon className="size-5" />
                </div>
                {label}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {config.framework === "hardhat" && (
        <div className="max-w-md mx-auto space-y-3">
          <h3 className="text-sm font-medium text-center">Hardhat Toolbox</h3>
          <div className="grid gap-3 grid-cols-2">
            <Card
              className={cn(
                "cursor-pointer transition-all",
                config.toolbox === "ethers" ? "ring-2 ring-primary" : "hover:shadow-sm"
              )}
              onClick={() => setConfig({ toolbox: "ethers" })}
            >
              <CardContent className="py-4 text-center">
                <p className="font-medium">Ethers</p>
                <p className="text-xs text-muted-foreground mt-1">
                  hardhat-toolbox-mocha-ethers
                </p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                "cursor-pointer transition-all",
                config.toolbox === "viem" ? "ring-2 ring-primary" : "hover:shadow-sm"
              )}
              onClick={() => setConfig({ toolbox: "viem" })}
            >
              <CardContent className="py-4 text-center">
                <p className="font-medium">Viem</p>
                <p className="text-xs text-muted-foreground mt-1">
                  hardhat-toolbox-viem
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

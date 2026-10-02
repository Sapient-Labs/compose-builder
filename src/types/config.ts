export type Framework = "foundry" | "hardhat";
export type HardhatToolbox = "ethers" | "viem";

export type DiamondConfig = {
  projectName: string;
  framework: Framework;
  toolbox?: HardhatToolbox;
  baseKey: string;
  selectedLibraries: string[];
  selectedExtensions: string[];
  selectedAccess: string[];
  selectedAccessExtensions: string[];
};

export const DEFAULT_CONFIG: DiamondConfig = {
  projectName: "my-diamond",
  framework: "foundry",
  baseKey: "none",
  selectedLibraries: [],
  selectedExtensions: [],
  selectedAccess: [],
  selectedAccessExtensions: [],
};

export type WizardStep =
  | "base"
  | "facets"
  | "libraries"
  | "access"
  | "framework"
  | "preview";

export const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: "base", label: "Base" },
  { key: "facets", label: "Facets" },
  { key: "libraries", label: "Libraries" },
  { key: "access", label: "Access" },
  { key: "framework", label: "Framework" },
  { key: "preview", label: "Preview" },
];

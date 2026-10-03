export type Framework = "foundry" | "hardhat";
export type HardhatToolbox = "ethers" | "viem";

export type DiamondConfig = {
  framework: Framework;
  toolbox?: HardhatToolbox;
  baseKey: string;
  selectedLibraries: string[];
  selectedExtensions: string[];
  selectedAccess: string[];
  selectedAccessExtensions: string[];
};

export const DEFAULT_CONFIG: DiamondConfig = {
  framework: "foundry",
  baseKey: "none",
  selectedLibraries: [],
  selectedExtensions: [],
  selectedAccess: [],
  selectedAccessExtensions: [],
};

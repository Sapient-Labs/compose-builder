import type { DiamondConfig } from "@/types/config";

function toProjectDirectoryName(name: string): string {
  const directoryName = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[._-]+/, "")
    .slice(0, 210);

  return directoryName || "my-diamond";
}

export function buildCliCommand(
  config: DiamondConfig,
  projectName = "my-diamond",
): string {
  const parts = [
    "npx",
    "@perfect-abstractions/compose-cli",
    "init",
    `--name ${toProjectDirectoryName(projectName)}`,
    "--yes",
  ];

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

  const ownership = config.selectedAccess.filter((value) =>
    ["owner", "ownable"].includes(value),
  );
  const roleAccess = config.selectedAccess.filter(
    (value) => !["owner", "ownable"].includes(value),
  );

  if (ownership.length > 0) parts.push(`--ownership ${ownership[0]}`);
  if (roleAccess.length > 0) {
    parts.push(`--access-control ${roleAccess.join(",")}`);
  }
  if (config.selectedAccessExtensions.length > 0) {
    parts.push(
      `--access-control-extensions ${config.selectedAccessExtensions.join(",")}`,
    );
  }

  return parts.join(" ");
}

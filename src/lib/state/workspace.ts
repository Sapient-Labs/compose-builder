import type { DiamondConfig } from '@/types/config';
import { DEFAULT_CONFIG } from '@/types/config';
import { DEFAULT_PROJECT_NAME } from '@/lib/compose-core/cli';

export { DEFAULT_PROJECT_NAME };

export const WORKSPACE_FORMAT = 'compose-launchpad-workspace';
export const WORKSPACE_VERSION = 1;
export const MAX_WORKSPACE_PROJECTS = 1;
export const MAX_WORKSPACE_BYTES = 4 * 1024 * 1024;

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  config: DiamondConfig;
};

export type Workspace = {
  format: typeof WORKSPACE_FORMAT;
  version: typeof WORKSPACE_VERSION;
  activeProjectId: string;
  projects: Project[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConfig(value: unknown): value is DiamondConfig {
  if (!isRecord(value)) return false;
  return (
    (value.framework === 'foundry' || value.framework === 'hardhat') &&
    (value.toolbox === undefined || value.toolbox === 'ethers' || value.toolbox === 'viem') &&
    typeof value.baseKey === 'string' &&
    ['selectedLibraries', 'selectedExtensions', 'selectedAccess', 'selectedAccessExtensions'].every(
      (key) => Array.isArray(value[key]) && value[key].every((item) => typeof item === 'string'),
    )
  );
}

function isProject(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    /^[A-Za-z0-9-]{1,80}$/.test(value.id) &&
    typeof value.name === 'string' &&
    value.name.length <= 100 &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.updatedAt === 'string' &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    isConfig(value.config)
  );
}

export function parseWorkspace(text: string): Workspace {
  if (new TextEncoder().encode(text).byteLength > MAX_WORKSPACE_BYTES) {
    throw new Error('Saved workspace exceeds the supported size.');
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Saved workspace is not valid JSON.');
  }

  if (!isRecord(value) || value.format !== WORKSPACE_FORMAT) {
    throw new Error('Saved workspace has an unsupported format.');
  }
  if (value.version !== WORKSPACE_VERSION) {
    throw new Error(`Unsupported workspace version: ${String(value.version)}.`);
  }
  if (
    typeof value.activeProjectId !== 'string' ||
    !Array.isArray(value.projects) ||
    value.projects.length > MAX_WORKSPACE_PROJECTS ||
    !value.projects.every(isProject)
  ) {
    throw new Error('Saved workspace contains invalid project data.');
  }
  if (
    value.projects.length > 0 &&
    !value.projects.some((project) => project.id === value.activeProjectId)
  ) {
    throw new Error('The saved active project is missing.');
  }
  if (value.projects.length === 0 && value.activeProjectId !== '') {
    throw new Error('An empty workspace cannot have an active project.');
  }

  return {
    format: WORKSPACE_FORMAT,
    version: WORKSPACE_VERSION,
    activeProjectId: value.activeProjectId,
    projects: value.projects,
  };
}

export function createProject(
  config: DiamondConfig = DEFAULT_CONFIG,
  name = DEFAULT_PROJECT_NAME,
): Project {
  const now = new Date().toISOString();
  const id = `project-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  return {
    id,
    name: name.trim() || DEFAULT_PROJECT_NAME,
    createdAt: now,
    updatedAt: now,
    config: { ...config },
  };
}

export function createWorkspace(config: DiamondConfig = DEFAULT_CONFIG): Workspace {
  const project = createProject(config);
  return {
    format: WORKSPACE_FORMAT,
    version: WORKSPACE_VERSION,
    activeProjectId: project.id,
    projects: [project],
  };
}

/** Converts the Zustand v0 persisted state into the versioned workspace shape. */
export function migrateLegacyState(value: unknown): Workspace | null {
  if (!isRecord(value) || !isConfig(value.config)) return null;
  return createWorkspace(value.config);
}

export function serializeWorkspace(workspace: Workspace): string {
  const text = JSON.stringify(workspace);
  if (new TextEncoder().encode(text).byteLength > MAX_WORKSPACE_BYTES) {
    throw new Error('Workspace exceeds the supported size.');
  }
  return text;
}

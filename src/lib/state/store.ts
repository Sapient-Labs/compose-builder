import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BasesCatalog } from "@/types/catalog";
import type { DiamondConfig } from "@/types/config";
import { DEFAULT_CONFIG } from "@/types/config";
import {
  createProject,
  createWorkspace,
  migrateLegacyState,
  parseWorkspace,
  serializeWorkspace,
  WORKSPACE_VERSION,
} from "./workspace";
import type { Project, Workspace } from "./workspace";

const initialWorkspace = createWorkspace();

export type EditorViewMode = "config" | "project";

type LaunchpadState = {
  workspace: Workspace;
  activeProject: Project | null;
  catalog: BasesCatalog | null;
  viewMode: EditorViewMode;
  sidebarCollapsed: boolean;
  isLoading: boolean;
  error: string | null;

  setConfig: (config: Partial<DiamondConfig>) => void;
  createProject: (name?: string) => void;
  updateProject: (patch: Partial<Pick<Project, "name" | "config">>) => void;
  deleteProject: () => void;
  selectProject: (projectId: string) => void;
  setCatalog: (catalog: BasesCatalog) => void;
  setViewMode: (viewMode: EditorViewMode) => void;
  toggleViewMode: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

export const useLaunchpadStore = create<LaunchpadState>()(
  persist(
    (set) => ({
      workspace: initialWorkspace,
      activeProject: initialWorkspace.projects[0] ?? null,
      catalog: null,
      viewMode: "config",
      sidebarCollapsed: false,
      isLoading: false,
      error: null,

      setConfig: (config) =>
        set((state) => {
          const project = state.workspace.projects.find(
            (item) => item.id === state.workspace.activeProjectId,
          );
          if (!project) return state;
          const updatedProject = {
            ...project,
            config: { ...project.config, ...config },
            updatedAt: new Date().toISOString(),
          };
          const workspace = {
            ...state.workspace,
            projects: state.workspace.projects.map((item) =>
              item.id === project.id ? updatedProject : item,
            ),
          };
          return { workspace, activeProject: updatedProject };
        }),

      createProject: (name) =>
        set((state) => {
          if (state.workspace.projects.length > 0) return state;
          const project = createProject(DEFAULT_CONFIG, name);
          return {
            workspace: { ...state.workspace, activeProjectId: project.id, projects: [project] },
            activeProject: project,
          };
        }),

      updateProject: (patch) =>
        set((state) => {
          const project = state.workspace.projects.find(
            (item) => item.id === state.workspace.activeProjectId,
          );
          if (!project) return state;
          const updatedProject = { ...project, ...patch, updatedAt: new Date().toISOString() };
          const workspace = {
            ...state.workspace,
            projects: state.workspace.projects.map((item) =>
              item.id === project.id ? updatedProject : item,
            ),
          };
          return { workspace, activeProject: updatedProject };
        }),

      deleteProject: () =>
        set((state) => ({
          workspace: { ...state.workspace, activeProjectId: "", projects: [] },
          activeProject: null,
        })),

      selectProject: (projectId) =>
        set((state) => {
          const project = state.workspace.projects.find((item) => item.id === projectId);
          if (!project) return state;
          return {
            workspace: { ...state.workspace, activeProjectId: project.id },
            activeProject: project,
          };
        }),

      setCatalog: (catalog) => set({ catalog }),

      setViewMode: (viewMode) => set({ viewMode }),

      toggleViewMode: () =>
        set((state) => ({
          viewMode: state.viewMode === "config" ? "project" : "config",
        })),

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      reset: () =>
        set(() => {
          const workspace = createWorkspace();
          return { workspace, activeProject: workspace.projects[0] ?? null, viewMode: "config", sidebarCollapsed: false, error: null };
        }),
    }),
    {
      name: "compose-launchpad",
      version: WORKSPACE_VERSION,
      migrate: (persistedState) => {
        const state = persistedState as Partial<LaunchpadState> | undefined;
        if (state?.workspace) {
          const workspace = parseWorkspace(serializeWorkspace(state.workspace));
          return {
            workspace,
            viewMode: state.viewMode ?? "config",
            sidebarCollapsed: state.sidebarCollapsed ?? false,
          };
        }
        const migrated = migrateLegacyState(state);
        if (migrated) {
          return {
            workspace: migrated,
            viewMode: state?.viewMode ?? "config",
            sidebarCollapsed: state?.sidebarCollapsed ?? false,
          };
        }
        return { workspace: createWorkspace(), viewMode: "config", sidebarCollapsed: false };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          useLaunchpadStore.setState({
            error: error instanceof Error ? error.message : "Saved workspace could not be loaded.",
          });
          return;
        }
        if (!state) return;
        state.activeProject =
          state.workspace.projects.find(
            (item) => item.id === state.workspace.activeProjectId,
          ) ?? null;
      },
      partialize: (state) => ({
        workspace: state.workspace,
        viewMode: state.viewMode,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

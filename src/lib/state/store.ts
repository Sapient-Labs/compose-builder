import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BasesCatalog } from "@/types/catalog";
import type { DiamondConfig } from "@/types/config";
import { DEFAULT_CONFIG } from "@/types/config";

export type EditorViewMode = "config" | "project";

type LaunchpadState = {
  config: DiamondConfig;
  catalog: BasesCatalog | null;
  viewMode: EditorViewMode;
  sidebarCollapsed: boolean;
  isLoading: boolean;
  error: string | null;

  setConfig: (config: Partial<DiamondConfig>) => void;
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
      config: DEFAULT_CONFIG,
      catalog: null,
      viewMode: "config",
      sidebarCollapsed: false,
      isLoading: false,
      error: null,

      setConfig: (config) =>
        set((state) => ({
          config: { ...state.config, ...config },
        })),

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
        set({
          config: DEFAULT_CONFIG,
          viewMode: "config",
          sidebarCollapsed: false,
          error: null,
        }),
    }),
    {
      name: "compose-launchpad",
      partialize: (state) => ({
        config: state.config,
        viewMode: state.viewMode,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

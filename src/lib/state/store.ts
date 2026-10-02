import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BasesCatalog } from "@/types/catalog";
import type { DiamondConfig, WizardStep } from "@/types/config";
import { DEFAULT_CONFIG, WIZARD_STEPS } from "@/types/config";

export type EditorViewMode = "config" | "project";

type LaunchpadState = {
  config: DiamondConfig;
  catalog: BasesCatalog | null;
  currentStep: WizardStep;
  viewMode: EditorViewMode;
  sidebarCollapsed: boolean;
  isLoading: boolean;
  error: string | null;

  setConfig: (config: Partial<DiamondConfig>) => void;
  setCatalog: (catalog: BasesCatalog) => void;
  setCurrentStep: (step: WizardStep) => void;
  setViewMode: (viewMode: EditorViewMode) => void;
  toggleViewMode: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  nextStep: () => void;
  prevStep: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

export const useLaunchpadStore = create<LaunchpadState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      catalog: null,
      currentStep: "base",
      viewMode: "config",
      sidebarCollapsed: false,
      isLoading: false,
      error: null,

      setConfig: (config) =>
        set((state) => ({
          config: { ...state.config, ...config },
        })),

      setCatalog: (catalog) => set({ catalog }),

      setCurrentStep: (step) => set({ currentStep: step }),

      setViewMode: (viewMode) => set({ viewMode }),

      toggleViewMode: () =>
        set((state) => ({
          viewMode: state.viewMode === "config" ? "project" : "config",
        })),

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      nextStep: () => {
        const { currentStep } = get();
        const currentIndex = WIZARD_STEPS.findIndex(
          (s) => s.key === currentStep
        );
        if (currentIndex < WIZARD_STEPS.length - 1) {
          set({ currentStep: WIZARD_STEPS[currentIndex + 1].key });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        const currentIndex = WIZARD_STEPS.findIndex(
          (s) => s.key === currentStep
        );
        if (currentIndex > 0) {
          set({ currentStep: WIZARD_STEPS[currentIndex - 1].key });
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      reset: () =>
        set({
          config: DEFAULT_CONFIG,
          currentStep: "base",
          viewMode: "config",
          sidebarCollapsed: false,
          error: null,
        }),
    }),
    {
      name: "compose-launchpad",
      partialize: (state) => ({
        config: state.config,
        currentStep: state.currentStep,
        viewMode: state.viewMode,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

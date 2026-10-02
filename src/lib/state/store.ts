import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BasesCatalog } from "@/types/catalog";
import type { DiamondConfig, WizardStep } from "@/types/config";
import { DEFAULT_CONFIG, WIZARD_STEPS } from "@/types/config";

type LaunchpadState = {
  config: DiamondConfig;
  catalog: BasesCatalog | null;
  currentStep: WizardStep;
  isLoading: boolean;
  error: string | null;

  setConfig: (config: Partial<DiamondConfig>) => void;
  setCatalog: (catalog: BasesCatalog) => void;
  setCurrentStep: (step: WizardStep) => void;
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
      isLoading: false,
      error: null,

      setConfig: (config) =>
        set((state) => ({
          config: { ...state.config, ...config },
        })),

      setCatalog: (catalog) => set({ catalog }),

      setCurrentStep: (step) => set({ currentStep: step }),

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
          error: null,
        }),
    }),
    {
      name: "compose-launchpad",
      partialize: (state) => ({
        config: state.config,
        currentStep: state.currentStep,
      }),
    }
  )
);

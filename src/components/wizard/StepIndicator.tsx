import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "@/types/config";
import { useLaunchpadStore } from "@/lib/state/store";
import { Check } from "lucide-react";

export function StepIndicator() {
  const { currentStep, setCurrentStep } = useLaunchpadStore();

  const getStepStatus = (stepKey: string) => {
    const currentIndex = WIZARD_STEPS.findIndex((s) => s.key === currentStep);
    const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === stepKey);

    if (stepIndex < currentIndex) return "completed";
    if (stepKey === currentStep) return "current";
    return "upcoming";
  };

  const isStepClickable = (stepKey: string) => {
    const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === stepKey);
    const currentIndex = WIZARD_STEPS.findIndex((s) => s.key === currentStep);
    return stepIndex <= currentIndex;
  };

  return (
    <nav className="flex items-center justify-center gap-2">
      {WIZARD_STEPS.map((step, index) => {
        const status = getStepStatus(step.key);
        const clickable = isStepClickable(step.key);

        return (
          <div key={step.key} className="flex items-center">
            <button
              type="button"
              onClick={() => clickable && setCurrentStep(step.key)}
              disabled={!clickable}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                status === "completed" &&
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                status === "current" &&
                  "bg-primary/10 text-primary ring-2 ring-primary",
                status === "upcoming" &&
                  "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {status === "completed" && <Check className="size-4" />}
              <span>{step.label}</span>
            </button>
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-0.5 w-8",
                  status === "completed" ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

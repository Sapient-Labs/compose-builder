import { useLaunchpadStore } from "@/lib/state/store";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "./StepIndicator";
import { BaseSelector } from "./BaseSelector";
import { FacetSelector } from "./FacetSelector";
import { LibrarySelector } from "./LibrarySelector";
import { AccessSelector } from "./AccessSelector";
import { FrameworkSelector } from "./FrameworkSelector";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function LaunchpadWizard() {
  const { currentStep, nextStep, prevStep } = useLaunchpadStore();

  const renderStep = () => {
    switch (currentStep) {
      case "base":
        return <BaseSelector />;
      case "facets":
        return <FacetSelector />;
      case "libraries":
        return <LibrarySelector />;
      case "access":
        return <AccessSelector />;
      case "framework":
        return <FrameworkSelector />;
      case "preview":
        return <PreviewPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <StepIndicator />

      <div className="min-h-[400px]">{renderStep()}</div>

      <div className="flex justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === "base"}
        >
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>

        {currentStep !== "preview" ? (
          <Button onClick={nextStep}>
            Next
            <ArrowRight className="size-4 ml-2" />
          </Button>
        ) : (
          <Button variant="default">
            Generate Project
          </Button>
        )}
      </div>
    </div>
  );
}

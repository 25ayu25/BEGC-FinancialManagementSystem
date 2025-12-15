import { CheckCircle2, Clock, Upload, FileSpreadsheet, PlayCircle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Card, CardContent } from "./card";

export interface StepState {
  completed: boolean;
  details?: string;
}

export interface ReconciliationStepperProps {
  steps: {
    claimsUploaded: StepState;
    remittanceUploaded: StepState;
    reconciliationRun: StepState;
    reviewExceptions: StepState;
  };
  onPrimaryAction: () => void;
  primaryActionLabel: string;
  primaryActionDisabled?: boolean;
  primaryActionLoading?: boolean;
  currentStep: 1 | 2 | 3 | 4;
}

export function ReconciliationStepper({
  steps,
  onPrimaryAction,
  primaryActionLabel,
  primaryActionDisabled,
  primaryActionLoading,
  currentStep,
}: ReconciliationStepperProps) {
  const stepConfig = [
    {
      number: 1,
      title: "Claims File",
      icon: FileSpreadsheet,
      state: steps.claimsUploaded,
    },
    {
      number: 2,
      title: "Remittance File",
      icon: Upload,
      state: steps.remittanceUploaded,
    },
    {
      number: 3,
      title: "Reconciliation",
      icon: PlayCircle,
      state: steps.reconciliationRun,
    },
    {
      number: 4,
      title: "Review Exceptions",
      icon: Eye,
      state: steps.reviewExceptions,
    },
  ];

  return (
    <Card className="border-2 border-orange-200 shadow-lg">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Step Progress Bar */}
          <div className="flex items-center justify-between relative">
            {/* Background line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 -z-10" />
            
            {/* Steps */}
            {stepConfig.map((step, idx) => {
              const Icon = step.icon;
              const isComplete = step.state.completed;
              const isCurrent = step.number === currentStep;
              
              return (
                <div key={step.number} className="flex flex-col items-center flex-1 relative">
                  {/* Connecting line (before this step) */}
                  {idx > 0 && (
                    <div
                      className={cn(
                        "absolute top-5 -left-1/2 w-full h-0.5 -z-10",
                        stepConfig[idx - 1].state.completed && isComplete
                          ? "bg-green-500"
                          : stepConfig[idx - 1].state.completed
                          ? "bg-orange-300"
                          : "bg-slate-200"
                      )}
                    />
                  )}
                  
                  {/* Step Circle */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all z-10 shadow-md",
                      isComplete
                        ? "bg-green-500 text-white"
                        : isCurrent
                        ? "bg-orange-500 text-white ring-4 ring-orange-200"
                        : "bg-slate-200 text-slate-500"
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  
                  {/* Step Label */}
                  <div className="mt-2 text-center">
                    <div
                      className={cn(
                        "text-xs font-medium",
                        isComplete
                          ? "text-green-700"
                          : isCurrent
                          ? "text-orange-700"
                          : "text-slate-500"
                      )}
                    >
                      {step.title}
                    </div>
                    {step.state.details && (
                      <div className="text-[10px] text-slate-500 mt-0.5 max-w-[100px] truncate">
                        {step.state.details}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Primary Action Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={onPrimaryAction}
              disabled={primaryActionDisabled || primaryActionLoading}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg"
              size="lg"
            >
              {primaryActionLoading ? (
                <>
                  <Clock className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                primaryActionLabel
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

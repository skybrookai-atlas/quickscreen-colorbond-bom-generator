import React from "react";
import { Check } from "lucide-react";

interface ProgressStepsProps {
  currentStep: number; // 1 to 5
  isSupplyOnly: boolean;
}

export function ProgressSteps({ currentStep, isSupplyOnly }: ProgressStepsProps) {
  const steps = [
    { number: 1, label: "Your details" },
    { number: 2, label: "Walkthrough video", skipable: true },
    { number: 3, label: isSupplyOnly ? "Pick pickup date" : "Pick install date" },
    { number: 4, label: "Review & deposit" },
    { number: 5, label: "Booked" },
  ];

  return (
    <div className="w-full bg-brand-card border-b border-brand-border py-4 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto gap-4 no-scrollbar">
        {steps.map((step, idx) => {
          const isCompleted = step.number < currentStep;
          const isActive = step.number === currentStep;
          const isSkipped = isSupplyOnly && step.skipable;

          // Determine class based on state
          let itemClass = "flex items-center gap-2 font-bold text-sm whitespace-nowrap ";
          let badgeClass = "flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0 ";

          if (isSkipped) {
            itemClass += "text-brand-muted line-through decoration-dashed";
            badgeClass += "bg-brand-border border border-dashed text-brand-muted";
          } else if (isCompleted) {
            itemClass += "text-brand-success";
            badgeClass += "bg-brand-success text-white";
          } else if (isActive) {
            itemClass += "text-brand-primary";
            badgeClass += "bg-brand-primary text-white ring-4 ring-brand-primary/20";
          } else {
            itemClass += "text-brand-muted";
            badgeClass += "bg-brand-border text-brand-muted";
          }

          return (
            <React.Fragment key={step.number}>
              <div className={itemClass} data-testid={`step-${step.number}-${isSkipped ? "skipped" : isActive ? "active" : isCompleted ? "completed" : "upcoming"}`}>
                <span className={badgeClass}>
                  {isCompleted && !isSkipped ? <Check size={14} /> : step.number}
                </span>
                <span>{step.label}</span>
              </div>

              {idx < steps.length - 1 && (
                <div
                  className={`hidden sm:block flex-1 h-[2px] min-w-4 max-w-16 ${
                    isSupplyOnly && idx === 1
                      ? "border-t-2 border-dashed border-brand-border"
                      : step.number < currentStep
                      ? "bg-brand-success"
                      : "bg-brand-border"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

"use client"

import { cn } from "@/lib/utils"

interface ProgressStep {
  id: string
  label: string
  status: "completed" | "current" | "pending" | "rejected"
  percentage: number
}

interface ProgressBarProps {
  steps: ProgressStep[]
  className?: string
}

export function ProgressBar({ steps, className }: ProgressBarProps) {
  const currentStep = steps.find(step => step.status === "current")
  const completedSteps = steps.filter(step => step.status === "completed")
  
  // Calculate progress percentage based on current step or last completed step
  let progressPercentage = 0
  if (currentStep) {
    progressPercentage = currentStep.percentage
  } else if (completedSteps.length > 0) {
    // If no current step, use the percentage of the last completed step
    const lastCompletedStep = completedSteps[completedSteps.length - 1]
    progressPercentage = lastCompletedStep.percentage
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Progress Bar */}
      <div className="relative mb-4">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-700 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Progress percentage */}
        <div className="flex justify-between items-center mt-2">
          <span className="text-sm font-medium text-gray-700">
            Progress: {progressPercentage}%
          </span>
          <span className="text-sm text-gray-500">
            {currentStep ? `Next: ${currentStep.label}` : 
             completedSteps.length > 0 ? "Awaiting next step" : "Not started"}
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center space-x-3">
            {/* Step indicator */}
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-500 ease-out",
              {
                "bg-green-500 text-white": step.status === "completed",
                "bg-blue-500 text-white": step.status === "current",
                "bg-gray-300 text-gray-600": step.status === "pending",
                "bg-red-500 text-white": step.status === "rejected"
              }
            )}>
              {step.status === "completed" ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : step.status === "rejected" ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            
            {/* Step label */}
            <div className="flex-1">
              <p className={cn(
                "text-sm font-medium",
                {
                  "text-green-700": step.status === "completed",
                  "text-blue-700": step.status === "current",
                  "text-gray-500": step.status === "pending",
                  "text-red-700": step.status === "rejected"
                }
              )}>
                {step.label}
              </p>
            </div>
            
            {/* Step status badge */}
            <div className="flex-shrink-0">
              <span className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                {
                  "bg-green-100 text-green-800": step.status === "completed",
                  "bg-blue-100 text-blue-800": step.status === "current",
                  "bg-gray-100 text-gray-800": step.status === "pending",
                  "bg-red-100 text-red-800": step.status === "rejected"
                }
              )}>
                {step.status === "completed" && "Completed"}
                {step.status === "current" && "In Progress"}
                {step.status === "pending" && "Pending"}
                {step.status === "rejected" && "Rejected"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

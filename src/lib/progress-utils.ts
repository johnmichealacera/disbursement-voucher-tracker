import { VoucherStatus, UserRole } from "@prisma/client"

interface ProgressStep {
  id: string
  label: string
  status: "completed" | "current" | "pending" | "rejected"
  percentage: number
}

interface DisbursementData {
  status: string | VoucherStatus
  createdBy: {
    role: UserRole
  }
  approvals: Array<{
    level: number
    status: string
    approver: {
      role: UserRole
    }
  }>
  auditTrails: Array<{
    action: string
    user: {
      role: UserRole
    }
  }>
}

export function calculateProgress(disbursement: DisbursementData): ProgressStep[] {
  const isGSOWorkflow = disbursement.createdBy.role === "GSO"
  const isHRWorkflow = disbursement.createdBy.role === "HR"
  
  if (isGSOWorkflow) {
    return calculateGSOProgress(disbursement)
  } else if (isHRWorkflow) {
    return calculateHRProgress(disbursement)
  } else {
    return calculateStandardProgress(disbursement)
  }
}

function calculateStandardProgress(disbursement: DisbursementData): ProgressStep[] {
  const steps: ProgressStep[] = [
    {
      id: "draft",
      label: "Draft Created",
      status: "completed",
      percentage: 10
    },
    {
      id: "submitted",
      label: "Submitted for Review",
      status: disbursement.status === "DRAFT" ? "pending" : "completed",
      percentage: 25
    },
    {
      id: "validated",
      label: "Department Head Validation",
      status: getStepStatus(disbursement, "VALIDATED", 25),
      percentage: 50
    },
    {
      id: "approved",
      label: "Finance Head Approval",
      status: getStepStatus(disbursement, "APPROVED", 50),
      percentage: 75
    },
    {
      id: "final-approved",
      label: "Mayor Final Approval",
      status: getStepStatus(disbursement, "APPROVED", 75),
      percentage: 90
    },
    {
      id: "released",
      label: "Treasury Release",
      status: disbursement.status === "RELEASED" ? "completed" : 
              disbursement.status === "REJECTED" ? "rejected" : "pending",
      percentage: 100
    }
  ]

  return adjustStepStatuses(steps, disbursement.status)
}

function calculateGSOProgress(disbursement: DisbursementData): ProgressStep[] {
  const steps: ProgressStep[] = [
    {
      id: "draft",
      label: "GSO Draft Created",
      status: "completed",
      percentage: 8
    },
    {
      id: "submitted",
      label: "Submitted for Review",
      status: disbursement.status === "DRAFT" ? "pending" : "completed",
      percentage: 16
    },
    {
      id: "mayor-review",
      label: "Mayor Review",
      status: getGSOReviewStatus(disbursement, "REVIEW", 16),
      percentage: 33
    },
    {
      id: "bac-review",
      label: "BAC Review",
      status: getGSOReviewStatus(disbursement, "BAC_REVIEW", 33),
      percentage: 50
    },
    {
      id: "budget-review",
      label: "Budget Office Review",
      status: getGSOReviewStatus(disbursement, "BUDGET_REVIEW", 50),
      percentage: 66
    },
    {
      id: "accounting-review",
      label: "Accounting Review",
      status: getGSOReviewStatus(disbursement, "ACCOUNTING_REVIEW", 66),
      percentage: 83
    },
    {
      id: "check-issuance",
      label: "Check Number Issuance",
      status: getTreasuryStatus(disbursement, "CHECK_ISSUANCE", 83),
      percentage: 90
    },
    {
      id: "available-release",
      label: "Available for Release",
      status: getTreasuryStatus(disbursement, "AVAILABLE_RELEASE", 95),
      percentage: 95
    },
    {
      id: "released",
      label: "Released",
      status: getTreasuryStatus(disbursement, "RELEASED", 100),
      percentage: 100
    }
  ]

  return adjustStepStatuses(steps, disbursement.status)
}

function calculateHRProgress(disbursement: DisbursementData): ProgressStep[] {
  // HR follows the same workflow as standard but with different labels
  const steps: ProgressStep[] = [
    {
      id: "draft",
      label: "HR Draft Created",
      status: "completed",
      percentage: 10
    },
    {
      id: "submitted",
      label: "Submitted for Review",
      status: disbursement.status === "DRAFT" ? "pending" : "completed",
      percentage: 25
    },
    {
      id: "validated",
      label: "Department Head Validation",
      status: getStepStatus(disbursement, "VALIDATED", 25),
      percentage: 50
    },
    {
      id: "approved",
      label: "Finance Head Approval",
      status: getStepStatus(disbursement, "APPROVED", 50),
      percentage: 75
    },
    {
      id: "final-approved",
      label: "Mayor Final Approval",
      status: getStepStatus(disbursement, "APPROVED", 75),
      percentage: 90
    },
    {
      id: "released",
      label: "Treasury Release",
      status: disbursement.status === "RELEASED" ? "completed" : 
              disbursement.status === "REJECTED" ? "rejected" : "pending",
      percentage: 100
    }
  ]

  return adjustStepStatuses(steps, disbursement.status)
}

function getStepStatus(disbursement: DisbursementData, targetStatus: string, percentage: number): "completed" | "current" | "pending" | "rejected" {
  if (disbursement.status === "REJECTED") return "rejected"
  
  const statusOrder = ["DRAFT", "PENDING", "VALIDATED", "APPROVED", "RELEASED"]
  const currentIndex = statusOrder.indexOf(disbursement.status as string)
  const targetIndex = statusOrder.indexOf(targetStatus)
  
  if (currentIndex > targetIndex) return "completed"
  if (currentIndex === targetIndex) return "current"
  return "pending"
}

function getGSOReviewStatus(disbursement: DisbursementData, actionType: string, percentage: number): "completed" | "current" | "pending" | "rejected" {
  if (disbursement.status === "REJECTED") return "rejected"
  
  // Special handling for Treasury review - check for check issuance
  if (actionType === "TREASURY_REVIEW") {
    const hasCheckIssuance = disbursement.auditTrails.some(trail => 
      trail.action === "CHECK_ISSUANCE" && trail.user.role === "TREASURY"
    )
    const hasMarkReleased = disbursement.auditTrails.some(trail => 
      trail.action === "MARK_RELEASED" && trail.user.role === "TREASURY"
    )
    
    if (hasMarkReleased) return "completed"
    if (hasCheckIssuance) return "current"
    
    // Check if this is the current step by looking at previous steps
    const previousSteps = getPreviousGSOActions(actionType)
    const allPreviousCompleted = previousSteps.every(prevAction =>
      disbursement.auditTrails.some(trail => 
        trail.action === prevAction && trail.user.role === getRoleForAction(prevAction)
      )
    )
    
    return allPreviousCompleted ? "current" : "pending"
  }
  
  // Check if this review step has been completed by looking at audit trails
  const hasReview = disbursement.auditTrails.some(trail => 
    trail.action === actionType && trail.user.role === getRoleForAction(actionType)
  )
  
  if (hasReview) return "completed"
  
  // Check if this is the current step by looking at previous steps
  const previousSteps = getPreviousGSOActions(actionType)
  const allPreviousCompleted = previousSteps.every(prevAction =>
    disbursement.auditTrails.some(trail => 
      trail.action === prevAction && trail.user.role === getRoleForAction(prevAction)
    )
  )
  
  return allPreviousCompleted ? "current" : "pending"
}

function getTreasuryStatus(disbursement: DisbursementData, actionType: string, percentage: number): "completed" | "current" | "pending" | "rejected" {
  if (disbursement.status === "REJECTED") return "rejected"
  
  const hasCheckIssuance = disbursement.auditTrails.some(trail => 
    trail.action === "CHECK_ISSUANCE" && trail.user.role === "TREASURY"
  )
  const hasMarkReleased = disbursement.auditTrails.some(trail => 
    trail.action === "MARK_RELEASED" && trail.user.role === "TREASURY"
  )
  
  switch (actionType) {
    case "CHECK_ISSUANCE":
      if (hasCheckIssuance) return "completed"
      // Check if Accounting has reviewed (prerequisite)
      const accountingHasReviewed = disbursement.auditTrails.some(trail => 
        trail.action === "ACCOUNTING_REVIEW" && trail.user.role === "ACCOUNTING"
      )
      return accountingHasReviewed ? "current" : "pending"
      
    case "AVAILABLE_RELEASE":
      if (hasMarkReleased) return "completed"
      if (hasCheckIssuance) return "current"
      return "pending"
      
    case "RELEASED":
      if (hasMarkReleased) return "completed"
      if (hasCheckIssuance) return "current"
      return "pending"
      
    default:
      return "pending"
  }
}

function getRoleForAction(actionType: string): UserRole {
  switch (actionType) {
    case "REVIEW": return "MAYOR"
    case "BAC_REVIEW": return "BAC"
    case "BUDGET_REVIEW": return "BUDGET"
    case "ACCOUNTING_REVIEW": return "ACCOUNTING"
    case "TREASURY_REVIEW": return "TREASURY"
    default: return "MAYOR"
  }
}

function getPreviousGSOActions(actionType: string): string[] {
  const actionOrder = ["REVIEW", "BAC_REVIEW", "BUDGET_REVIEW", "ACCOUNTING_REVIEW", "TREASURY_REVIEW"]
  const currentIndex = actionOrder.indexOf(actionType)
  return actionOrder.slice(0, currentIndex)
}

function adjustStepStatuses(steps: ProgressStep[], currentStatus: string | VoucherStatus): ProgressStep[] {
  if (currentStatus === "REJECTED") {
    return steps.map(step => ({
      ...step,
      status: step.status === "completed" ? "completed" : "rejected" as const
    }))
  }

  // Find the current step and mark it as current
  const currentStepIndex = steps.findIndex(step => step.status === "current")
  if (currentStepIndex === -1) {
    // No current step found, all are either completed or pending
    return steps.map(step => ({
      ...step,
      status: step.status === "pending" ? "pending" : step.status
    }))
  }

  return steps.map((step, index) => ({
    ...step,
    status: index < currentStepIndex ? "completed" as const :
            index === currentStepIndex ? "current" as const :
            "pending" as const
  }))
}

import { VoucherStatus, UserRole } from "@prisma/client"

interface ProgressStep {
  id: string
  label: string
  status: "completed" | "current" | "pending" | "rejected"
  percentage: number
  completedBy?: string
}

interface DisbursementData {
  bacReviews: Array<{
    status: string
    reviewer?: {
      role: UserRole
      name?: string
    }
    reviewerId?: string
  }>
  status: string | VoucherStatus
  createdBy: {
    role: UserRole
    name?: string
  }
  approvals: Array<{
    level: number
    status: string
    approver: {
      role: UserRole
      name?: string
    }
  }>
  auditTrails: Array<{
    action: string
    user: {
      role: UserRole
      name?: string
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newValues?: any
  }>
}

function joinNames(names: string[]): string | undefined {
  const uniqueNames = Array.from(new Set(names.filter(Boolean)))
  if (uniqueNames.length === 0) return undefined
  if (uniqueNames.length === 1) return uniqueNames[0]
  return uniqueNames.join(", ")
}

function getApprovalNames(disbursement: DisbursementData, levels: number | number[]): string | undefined {
  if (!disbursement?.approvals?.length) return undefined
  const targetLevels = Array.isArray(levels) ? levels : [levels]
  const names = disbursement.approvals
    .filter(approval => targetLevels.includes(approval.level) && approval.status === "APPROVED")
    .map(approval => approval.approver?.name)
    .filter(Boolean) as string[]
  return joinNames(names)
}

function getAuditActionNames(disbursement: DisbursementData, actions: string | string[]): string | undefined {
  if (!disbursement?.auditTrails?.length) return undefined
  const targetActions = Array.isArray(actions)
    ? actions.map(action => action.toUpperCase())
    : [actions.toUpperCase()]
  const names = disbursement.auditTrails
    .filter(trail => targetActions.includes(trail.action.toUpperCase()))
    .map(trail => trail.user?.name)
    .filter(Boolean) as string[]
  return joinNames(names)
}

function getBacReviewerNames(disbursement: DisbursementData): string | undefined {
  if (!disbursement?.bacReviews?.length) return undefined
  const names = disbursement.bacReviews
    .filter(review => review.status === "APPROVED")
    .map(review => review.reviewer?.name)
    .filter(Boolean) as string[]
  return joinNames(names)
}

export function calculateProgress(disbursement: DisbursementData): ProgressStep[] {
  // Add null checks to prevent errors
  if (!disbursement || !disbursement.createdBy) {
    return []
  }
  
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
  // Add null checks
  if (!disbursement || !disbursement.approvals) {
    return []
  }
  
  const steps: ProgressStep[] = [
    {
      id: "draft",
      label: "Draft Created",
      status: "completed",
      percentage: 8,
      completedBy: disbursement.createdBy?.name
    },
    {
      id: "submitted",
      label: "Submitted for Review",
      status: disbursement.status === "DRAFT" ? "pending" : "completed",
      percentage: 16,
      completedBy: disbursement.status === "DRAFT" ? undefined : getAuditActionNames(disbursement, "SUBMIT")
    },
    {
      id: "secretary-review",
      label: "Secretary Review",
      status: getStandardReviewStatus(disbursement, "SECRETARY_REVIEW", 16),
      percentage: 25,
      completedBy: getApprovalNames(disbursement, 1)
    },
    {
      id: "mayor-review",
      label: "Mayor Review",
      status: getStandardReviewStatus(disbursement, "REVIEW", 25),
      percentage: 40,
      completedBy: getApprovalNames(disbursement, 2)
    },
    {
      id: "budget-review",
      label: "Budget Office Review",
      status: getStandardReviewStatus(disbursement, "BUDGET_REVIEW", 40),
      percentage: 60,
      completedBy: getApprovalNames(disbursement, 3)
    },
    {
      id: "accounting-review",
      label: "Accounting Review",
      status: getStandardReviewStatus(disbursement, "ACCOUNTING_REVIEW", 60),
      percentage: 80,
      completedBy: getApprovalNames(disbursement, 4)
    },
    {
      id: "check-issuance",
      label: "Check Number Issuance",
      status: getTreasuryStatus(disbursement, "CHECK_ISSUANCE", 80),
      percentage: 90,
      completedBy: getAuditActionNames(disbursement, "CHECK_ISSUANCE")
    },
    {
      id: "available-release",
      label: "Available for Release",
      status: getTreasuryStatus(disbursement, "AVAILABLE_RELEASE", 95),
      percentage: 95,
      completedBy: getAuditActionNames(disbursement, ["CHECK_ISSUANCE", "MARK_RELEASED"])
    },
    {
      id: "released",
      label: "Released",
      status: disbursement.status === "RELEASED" ? "completed" : 
        ["REJECTED", "CANCELLED"].includes(disbursement.status as string) ? "rejected" : "pending",
      percentage: 100,
      completedBy: disbursement.status === "RELEASED" ? getAuditActionNames(disbursement, "MARK_RELEASED") : undefined
    }
  ]

  return adjustStepStatuses(steps, disbursement.status)
}

function calculateGSOProgress(disbursement: DisbursementData): ProgressStep[] {
  // Add null checks
  if (!disbursement || !disbursement.approvals || !disbursement.auditTrails) {
    return []
  }
  
  const steps: ProgressStep[] = [
    {
      id: "draft",
      label: "GSO Draft Created",
      status: "completed",
      percentage: 6,
      completedBy: disbursement.createdBy?.name
    },
    {
      id: "submitted",
      label: "Submitted for Review",
      status: disbursement.status === "DRAFT" ? "pending" : "completed",
      percentage: 12,
      completedBy: disbursement.status === "DRAFT" ? undefined : getAuditActionNames(disbursement, "SUBMIT")
    },
    {
      id: "secretary-review",
      label: "Secretary Review",
      status: getGSOReviewStatus(disbursement, "SECRETARY_REVIEW", 12),
      percentage: 20,
      completedBy: getApprovalNames(disbursement, 1)
    },
    {
      id: "mayor-review",
      label: "Mayor Review",
      status: getGSOReviewStatus(disbursement, "REVIEW", 20),
      percentage: 33,
      completedBy: getApprovalNames(disbursement, 2)
    },
    {
      id: "bac-review",
      label: "BAC Review",
      status: getGSOReviewStatus(disbursement, "BAC_REVIEW", 33),
      percentage: 50,
      completedBy: getBacReviewerNames(disbursement)
    },
    {
      id: "budget-review",
      label: "Budget Office Review",
      status: getGSOReviewStatus(disbursement, "BUDGET_REVIEW", 50),
      percentage: 66,
      completedBy: getApprovalNames(disbursement, 4)
    },
    {
      id: "accounting-review",
      label: "Accounting Review",
      status: getGSOReviewStatus(disbursement, "ACCOUNTING_REVIEW", 66),
      percentage: 83,
      completedBy: getApprovalNames(disbursement, 5)
    },
    {
      id: "check-issuance",
      label: "Check Number Issuance",
      status: getTreasuryStatus(disbursement, "CHECK_ISSUANCE", 83),
      percentage: 90,
      completedBy: getAuditActionNames(disbursement, "CHECK_ISSUANCE")
    },
    {
      id: "available-release",
      label: "Available for Release",
      status: getTreasuryStatus(disbursement, "AVAILABLE_RELEASE", 95),
      percentage: 95,
      completedBy: getAuditActionNames(disbursement, ["CHECK_ISSUANCE", "MARK_RELEASED"])
    },
    {
      id: "released",
      label: "Released",
      status: getTreasuryStatus(disbursement, "RELEASED", 100),
      percentage: 100,
      completedBy: getAuditActionNames(disbursement, "MARK_RELEASED")
    }
  ]

  return adjustStepStatuses(steps, disbursement.status)
}

function calculateHRProgress(disbursement: DisbursementData): ProgressStep[] {
  // Add null checks
  if (!disbursement || !disbursement.approvals) {
    return []
  }
  
  // HR follows the same workflow as standard but with different labels
  const steps: ProgressStep[] = [
    {
      id: "draft",
      label: "HR Draft Created",
      status: "completed",
      percentage: 8,
      completedBy: disbursement.createdBy?.name
    },
    {
      id: "submitted",
      label: "Submitted for Review",
      status: disbursement.status === "DRAFT" ? "pending" : "completed",
      percentage: 16,
      completedBy: disbursement.status === "DRAFT" ? undefined : getAuditActionNames(disbursement, "SUBMIT")
    },
    {
      id: "secretary-review",
      label: "Secretary Review",
      status: getStandardReviewStatus(disbursement, "SECRETARY_REVIEW", 16),
      percentage: 25,
      completedBy: getApprovalNames(disbursement, 1)
    },
    {
      id: "mayor-review",
      label: "Mayor Review",
      status: getStandardReviewStatus(disbursement, "REVIEW", 25),
      percentage: 40,
      completedBy: getApprovalNames(disbursement, 2)
    },
    {
      id: "budget-review",
      label: "Budget Office Review",
      status: getStandardReviewStatus(disbursement, "BUDGET_REVIEW", 40),
      percentage: 60,
      completedBy: getApprovalNames(disbursement, 3)
    },
    {
      id: "accounting-review",
      label: "Accounting Review",
      status: getStandardReviewStatus(disbursement, "ACCOUNTING_REVIEW", 60),
      percentage: 80,
      completedBy: getApprovalNames(disbursement, 4)
    },
    {
      id: "check-issuance",
      label: "Check Number Issuance",
      status: getTreasuryStatus(disbursement, "CHECK_ISSUANCE", 80),
      percentage: 90,
      completedBy: getAuditActionNames(disbursement, "CHECK_ISSUANCE")
    },
    {
      id: "available-release",
      label: "Available for Release",
      status: getTreasuryStatus(disbursement, "AVAILABLE_RELEASE", 95),
      percentage: 95,
      completedBy: getAuditActionNames(disbursement, ["CHECK_ISSUANCE", "MARK_RELEASED"])
    },
    {
      id: "released",
      label: "Released",
      status: disbursement.status === "RELEASED" ? "completed" : 
              ["REJECTED", "CANCELLED"].includes(disbursement.status as string) ? "rejected" : "pending",
      percentage: 100,
      completedBy: disbursement.status === "RELEASED" ? getAuditActionNames(disbursement, "MARK_RELEASED") : undefined
    }
  ]

  return adjustStepStatuses(steps, disbursement.status)
}

function getStandardReviewStatus(disbursement: DisbursementData, actionType: string, percentage: number): "completed" | "current" | "pending" | "rejected" {
  if (!disbursement || !disbursement.approvals) {
    return "pending"
  }
  
  if (["REJECTED", "CANCELLED"].includes(disbursement.status as string)) return "rejected"
  
  // Map action types to approval levels
  const actionToLevel: Record<string, number> = {
    "SECRETARY_REVIEW": 1,
    "REVIEW": 2,
    "BUDGET_REVIEW": 3,
    "ACCOUNTING_REVIEW": 4,
    "TREASURY_REVIEW": 5
  }
  
  const targetLevel = actionToLevel[actionType]
  if (!targetLevel) return "pending"
  
  // Check if this review step has been completed by looking at approvals
  const hasReview = disbursement.approvals.some(approval => 
    approval.level === targetLevel && approval.status === "APPROVED"
  )
  
  if (hasReview) return "completed"
  
  // Check if this is the current step by looking at previous levels
  const previousLevels = Array.from({ length: targetLevel - 1 }, (_, i) => i + 1)
  const allPreviousCompleted = previousLevels.every(level =>
    disbursement.approvals.some(approval => 
      approval.level === level && approval.status === "APPROVED"
    )
  )
  
  return allPreviousCompleted ? "current" : "pending"
}

function getStepStatus(disbursement: DisbursementData, targetStatus: string, percentage: number): "completed" | "current" | "pending" | "rejected" {
  if (["REJECTED", "CANCELLED"].includes(disbursement.status as string)) return "rejected"
  
  const statusOrder = ["DRAFT", "PENDING", "VALIDATED", "APPROVED", "RELEASED", "REJECTED", "CANCELLED"]
  const currentIndex = statusOrder.indexOf(disbursement.status as string)
  const targetIndex = statusOrder.indexOf(targetStatus)
  
  if (currentIndex > targetIndex) return "completed"
  if (currentIndex === targetIndex) return "current"
  return "pending"
}

function getGSOReviewStatus(disbursement: DisbursementData, actionType: string, percentage: number): "completed" | "current" | "pending" | "rejected" {
  if (!disbursement || !disbursement.approvals || !disbursement.auditTrails) {
    return "pending"
  }
  
  if (["REJECTED", "CANCELLED"].includes(disbursement.status as string)) return "rejected"
  
  // Special handling for BAC review - check BacReview records instead of approval levels
  if (actionType === "BAC_REVIEW") {
    const bacReviewCount = disbursement.bacReviews ? disbursement.bacReviews.length : 0
    if (bacReviewCount >= 3) return "completed"
    
    // Check if Mayor has reviewed (prerequisite for BAC review) - Mayor is level 2 in GSO workflow
    const mayorHasReviewed = disbursement.approvals.some(approval => 
      approval.level === 2 && approval.status === "APPROVED"
    )
    
    // Check if Secretary has reviewed (prerequisite for Mayor) - Secretary is level 1
    const secretaryHasReviewed = disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED"
    )
    
    // BAC can only start if both Secretary and Mayor have reviewed
    if (secretaryHasReviewed && mayorHasReviewed) {
      return bacReviewCount > 0 ? "current" : "current"
    }
    
    return "pending"
  }
  
  // Map action types to approval levels for GSO workflow
  const actionToLevel: Record<string, number> = {
    "SECRETARY_REVIEW": 1,
    "REVIEW": 2,
    "BUDGET_REVIEW": 4, // Budget is Level 4 in GSO workflow (after BAC)
    "ACCOUNTING_REVIEW": 5,
    "TREASURY_REVIEW": 6
  }
  
  const targetLevel = actionToLevel[actionType]
  if (!targetLevel) return "pending"
  
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
    
    // Check if this is the current step by looking at previous levels
    const previousLevels = Array.from({ length: targetLevel - 1 }, (_, i) => i + 1)
    const allPreviousCompleted = previousLevels.every(level =>
      disbursement.approvals.some(approval => 
        approval.level === level && approval.status === "APPROVED"
      )
    )
    
    return allPreviousCompleted ? "current" : "pending"
  }
  
  // Check if this review step has been completed by looking at approvals
  const hasReview = disbursement.approvals.some(approval => 
    approval.level === targetLevel && approval.status === "APPROVED"
  )
  
  if (hasReview) return "completed"
  
  // Check if this is the current step by looking at previous levels
  const previousLevels = Array.from({ length: targetLevel - 1 }, (_, i) => i + 1)
  const allPreviousCompleted = previousLevels.every(level =>
    disbursement.approvals.some(approval => 
      approval.level === level && approval.status === "APPROVED"
    )
  )
  
  return allPreviousCompleted ? "current" : "pending"
}

function getTreasuryStatus(disbursement: DisbursementData, actionType: string, percentage: number): "completed" | "current" | "pending" | "rejected" {
  if (!disbursement || !disbursement.auditTrails) {
    return "pending"
  }
  
  if (["REJECTED", "CANCELLED"].includes(disbursement.status as string)) return "rejected"
  
  const hasCheckIssuance = disbursement.auditTrails.some(trail => 
    trail.action === "CHECK_ISSUANCE" && trail.user.role === "TREASURY"
  )
  const hasMarkReleased = disbursement.auditTrails.some(trail => 
    trail.action === "MARK_RELEASED" && trail.user.role === "TREASURY"
  )
  
  switch (actionType) {
    case "CHECK_ISSUANCE":
      if (hasCheckIssuance) return "completed"
      // Check if Accounting has reviewed (prerequisite) - use approval levels
      const accountingHasReviewed = disbursement.approvals.some(approval => 
        (disbursement.createdBy.role === "GSO" && approval.level === 5 && approval.status === "APPROVED") || // GSO workflow: Accounting is Level 5
        (disbursement.createdBy.role !== "GSO" && approval.level === 4 && approval.status === "APPROVED")    // Standard workflow: Accounting is Level 4
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
    case "SECRETARY_REVIEW": return "SECRETARY"
    case "REVIEW": return "MAYOR"
    case "BAC_REVIEW": return "BAC"
    case "BUDGET_REVIEW": return "BUDGET"
    case "ACCOUNTING_REVIEW": return "ACCOUNTING"
    case "TREASURY_REVIEW": return "TREASURY"
    default: return "SECRETARY"
  }
}

function getPreviousStandardActions(actionType: string): string[] {
  const actionOrder = ["SECRETARY_REVIEW", "REVIEW", "BUDGET_REVIEW", "ACCOUNTING_REVIEW", "TREASURY_REVIEW"]
  const currentIndex = actionOrder.indexOf(actionType)
  return actionOrder.slice(0, currentIndex)
}

function getPreviousGSOActions(actionType: string): string[] {
  const actionOrder = ["SECRETARY_REVIEW", "REVIEW", "BAC_REVIEW", "BUDGET_REVIEW", "ACCOUNTING_REVIEW", "TREASURY_REVIEW"]
  const currentIndex = actionOrder.indexOf(actionType)
  return actionOrder.slice(0, currentIndex)
}

function adjustStepStatuses(steps: ProgressStep[], currentStatus: string | VoucherStatus): ProgressStep[] {
  if (["REJECTED", "CANCELLED"].includes(currentStatus as string)) {
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

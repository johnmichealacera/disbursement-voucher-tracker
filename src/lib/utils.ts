/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import bcrypt from "bcryptjs"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(num)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

export function getStatusColor(status: string | undefined | null): string {
  if (!status) {
    return 'bg-gray-100 text-gray-800'
  }
  
  switch (status.toLowerCase()) {
    case 'draft':
      return 'bg-gray-100 text-gray-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'validated':
      return 'bg-blue-100 text-blue-800'
    case 'approved':
      return 'bg-green-100 text-green-800'
    case 'released':
      return 'bg-emerald-100 text-emerald-800'
    case 'rejected':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'REQUESTER':
      return 'Requester'
    case 'ACCOUNTING':
      return 'Accounting'
    case 'BUDGET':
      return 'Budget Officer'
    case 'TREASURY':
      return 'Treasury'
    case 'MAYOR':
      return 'Mayor'
    case 'ADMIN':
      return 'Administrator'
    case 'DEPARTMENT_HEAD':
      return 'Department Head'
    case 'FINANCE_HEAD':
      return 'Finance Head'
    case 'GSO':
      return 'General Services Office'
    case 'HR':
      return 'Human Resources'
    case 'BAC':
      return 'Bids and Awards Committee'
    case 'SECRETARY':
      return 'Secretary'
    default:
      return role
  }
}

export function getCurrentReviewer(disbursement: any): { role: string; displayName: string; status: string } | null {
  if (!disbursement || !disbursement.approvals) {
    return null
  }

  const { createdBy, approvals, bacReviews, status, auditTrails } = disbursement

  // If voucher is rejected or released, no current reviewer
  if (status === 'REJECTED' || status === 'RELEASED') {
    return null
  }

  // If still in draft, creator is the current reviewer
  if (status === 'DRAFT') {
    return {
      role: createdBy.role,
      displayName: getRoleDisplayName(createdBy.role),
      status: 'Draft'
    }
  }

  // For GSO workflow
  if (createdBy.role === 'GSO') {
    // Check if Secretary has reviewed
    const secretaryApproved = approvals.some((approval: any) => 
      approval.level === 1 && approval.status === 'APPROVED'
    )
    
    if (!secretaryApproved) {
      return {
        role: 'SECRETARY',
        displayName: 'Secretary',
        status: 'Awaiting Secretary Review'
      }
    }

    // Check if Mayor has reviewed
    const mayorApproved = approvals.some((approval: any) => 
      approval.level === 2 && approval.status === 'APPROVED'
    )
    
    if (!mayorApproved) {
      return {
        role: 'MAYOR',
        displayName: 'Mayor',
        status: 'Awaiting Mayor Review'
      }
    }

    // Check BAC reviews
    const bacReviewCount = bacReviews ? bacReviews.length : 0
    if (bacReviewCount < 3) {
      return {
        role: 'BAC',
        displayName: 'BAC Committee',
        status: `Awaiting BAC Review (${bacReviewCount}/3)`
      }
    }

    // Check Budget approval
    const budgetApproved = approvals.some((approval: any) => 
      approval.level === 4 && approval.status === 'APPROVED'
    )
    
    if (!budgetApproved) {
      return {
        role: 'BUDGET',
        displayName: 'Budget Officer',
        status: 'Awaiting Budget Review'
      }
    }

    // Check Accounting approval
    const accountingApproved = approvals.some((approval: any) => 
      approval.level === 5 && approval.status === 'APPROVED'
    )
    
    if (!accountingApproved) {
      return {
        role: 'ACCOUNTING',
        displayName: 'Accounting Officer',
        status: 'Awaiting Accounting Review'
      }
    }

    // Check Treasury actions (only if auditTrails is available)
    if (auditTrails && auditTrails.length > 0) {
      const hasCheckIssuance = auditTrails.some((trail: any) => 
        trail.action === 'CHECK_ISSUANCE' && trail.user.role === 'TREASURY'
      )
      const hasMarkReleased = auditTrails.some((trail: any) => 
        trail.action === 'MARK_RELEASED' && trail.user.role === 'TREASURY'
      )

      if (!hasCheckIssuance) {
        return {
          role: 'TREASURY',
          displayName: 'Treasury Officer',
          status: 'Awaiting Check Issuance'
        }
      }

      if (!hasMarkReleased) {
        return {
          role: 'TREASURY',
          displayName: 'Treasury Officer',
          status: 'Awaiting Release'
        }
      }
    } else {
      // If no audit trails, assume Treasury needs to act
      return {
        role: 'TREASURY',
        displayName: 'Treasury Officer',
        status: 'Awaiting Treasury Action'
      }
    }
  }

  // For Standard workflow (non-GSO)
  // Check Secretary approval
  const secretaryApproved = approvals.some((approval: any) => 
    approval.level === 1 && approval.status === 'APPROVED'
  )
  
  if (!secretaryApproved) {
    return {
      role: 'SECRETARY',
      displayName: 'Secretary',
      status: 'Awaiting Secretary Review'
    }
  }

  // Check Mayor approval
  const mayorApproved = approvals.some((approval: any) => 
    approval.level === 2 && approval.status === 'APPROVED'
  )
  
  if (!mayorApproved) {
    return {
      role: 'MAYOR',
      displayName: 'Mayor',
      status: 'Awaiting Mayor Review'
    }
  }

  // Check Budget approval
  const budgetApproved = approvals.some((approval: any) => 
    approval.level === 3 && approval.status === 'APPROVED'
  )
  
  if (!budgetApproved) {
    return {
      role: 'BUDGET',
      displayName: 'Budget Officer',
      status: 'Awaiting Budget Review'
    }
  }

  // Check Accounting approval
  const accountingApproved = approvals.some((approval: any) => 
    approval.level === 4 && approval.status === 'APPROVED'
  )
  
  if (!accountingApproved) {
    return {
      role: 'ACCOUNTING',
      displayName: 'Accounting Officer',
      status: 'Awaiting Accounting Review'
    }
  }

  // Check Treasury actions (only if auditTrails is available)
  if (auditTrails && auditTrails.length > 0) {
    const hasCheckIssuance = auditTrails.some((trail: any) => 
      trail.action === 'CHECK_ISSUANCE' && trail.user.role === 'TREASURY'
    )
    const hasMarkReleased = auditTrails.some((trail: any) => 
      trail.action === 'MARK_RELEASED' && trail.user.role === 'TREASURY'
    )

    if (!hasCheckIssuance) {
      return {
        role: 'TREASURY',
        displayName: 'Treasury Officer',
        status: 'Awaiting Check Issuance'
      }
    }

    if (!hasMarkReleased) {
      return {
        role: 'TREASURY',
        displayName: 'Treasury Officer',
        status: 'Awaiting Release'
      }
    }
  } else {
    // If no audit trails, assume Treasury needs to act
    return {
      role: 'TREASURY',
      displayName: 'Treasury Officer',
      status: 'Awaiting Treasury Action'
    }
  }

  return null
}

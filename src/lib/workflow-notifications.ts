import { prisma } from "./prisma"
import { UserRole } from "@prisma/client"

interface NotificationData {
  disbursementId: string
  payee: string
  amount: number
  action: string
  performedBy: string
  performedByRole: UserRole
  disbursementCreatedBy: UserRole
  remarks?: string
  checkNumber?: string
}

export async function sendWorkflowNotifications(data: NotificationData) {
  try {
    // Determine which departments should be notified based on the workflow
    const departmentsToNotify = getDepartmentsToNotify(data.disbursementCreatedBy, data.action)
    
    // Get all users from the departments that should be notified
    const usersToNotify = await prisma.user.findMany({
      where: {
        role: {
          in: departmentsToNotify
        },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        role: true,
        department: true
      }
    })

    // Create notification message based on the action
    const notificationMessage = createNotificationMessage(data)
    
    // Create notifications for all relevant users
    const notifications = usersToNotify.map(user => ({
      type: "workflow_update",
      title: "Disbursement Status Update",
      message: notificationMessage,
      priority: getNotificationPriority(data.action),
      userId: user.id,
      disbursementVoucherId: data.disbursementId
    }))

    // Bulk create notifications
    await prisma.notification.createMany({
      data: notifications
    })

    console.log(`Sent workflow notifications to ${notifications.length} users for disbursement ${data.disbursementId}`)
  } catch (error) {
    console.error("Error sending workflow notifications:", error)
  }
}

function getDepartmentsToNotify(disbursementCreatedBy: UserRole, action: string): UserRole[] {
  // Base departments that should always be notified
  const baseDepartments: UserRole[] = ["ADMIN"]
  
  // Add requester's department
  baseDepartments.push(disbursementCreatedBy)
  
  // Add departments based on workflow type
  if (disbursementCreatedBy === "GSO") {
    // GSO workflow: Mayor, BAC, Budget, Accounting, Treasury
    baseDepartments.push("MAYOR", "BAC", "BUDGET", "ACCOUNTING", "TREASURY")
  } else if (disbursementCreatedBy === "HR") {
    // HR workflow: Department Head, Finance Head, Mayor, Treasury
    baseDepartments.push("DEPARTMENT_HEAD", "FINANCE_HEAD", "MAYOR", "TREASURY")
  } else {
    // Standard workflow: Department Head, Finance Head, Accounting, Mayor, Treasury
    baseDepartments.push("DEPARTMENT_HEAD", "FINANCE_HEAD", "ACCOUNTING", "MAYOR", "TREASURY")
  }
  
  // Remove duplicates
  return [...new Set(baseDepartments)]
}

function createNotificationMessage(data: NotificationData): string {
  const { payee, amount, action, performedBy, performedByRole, remarks, checkNumber } = data
  
  const formattedAmount = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount)

  switch (action) {
    case "CREATE":
      return `New disbursement voucher "${payee}" (${formattedAmount}) has been created by ${performedBy}`
      
    case "SUBMIT":
      return `Disbursement voucher "${payee}" (${formattedAmount}) has been submitted for review by ${performedBy}`
      
    case "APPROVE":
      return `Disbursement voucher "${payee}" (${formattedAmount}) has been approved by ${performedBy} (${performedByRole.replace("_", " ")})`
      
    case "REJECT":
      return `Disbursement voucher "${payee}" (${formattedAmount}) has been rejected by ${performedBy} (${performedByRole.replace("_", " ")})`
      
    case "VALIDATE":
      return `Disbursement voucher "${payee}" (${formattedAmount}) has been validated by ${performedBy} (${performedByRole.replace("_", " ")})`
      
    case "REVIEW":
      return `Disbursement voucher "${payee}" (${formattedAmount}) has been reviewed by ${performedBy} (Mayor)`
      
    case "BAC_REVIEW":
      return `Disbursement voucher "${payee}" (${formattedAmount}) has been reviewed by BAC Committee (${performedBy})`
      
    case "BUDGET_REVIEW":
      return `Disbursement voucher "${payee}" (${formattedAmount}) has been reviewed by Budget Office (${performedBy})`
      
    case "ACCOUNTING_REVIEW":
      return `Disbursement voucher "${payee}" (${formattedAmount}) has been reviewed by Accounting Office (${performedBy})`
      
    case "CHECK_ISSUANCE":
      return `Check #${checkNumber} has been issued for disbursement "${payee}" (${formattedAmount}) by Treasury Office (${performedBy})`
      
    case "MARK_RELEASED":
      return `Disbursement voucher "${payee}" (${formattedAmount}) has been released by Treasury Office (${performedBy})`
      
    default:
      return `Disbursement voucher "${payee}" (${formattedAmount}) status updated by ${performedBy} (${performedByRole.replace("_", " ")})`
  }
}

function getNotificationPriority(action: string): "high" | "medium" | "low" {
  switch (action) {
    case "REJECT":
    case "CHECK_ISSUANCE":
    case "MARK_RELEASED":
      return "high"
    case "APPROVE":
    case "REVIEW":
    case "BAC_REVIEW":
    case "BUDGET_REVIEW":
    case "ACCOUNTING_REVIEW":
      return "medium"
    default:
      return "low"
  }
}

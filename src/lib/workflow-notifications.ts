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
    console.log(`Starting workflow notifications for disbursement: ${data.disbursementId}, created by: ${data.disbursementCreatedBy}`)
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Notification timeout')), 10000) // 10 second timeout
    })
    
    const notificationPromise = (async () => {
      // Determine which departments should be notified based on the workflow
      const departmentsToNotify = getDepartmentsToNotify(data.disbursementCreatedBy, data.action)
      console.log(`Departments to notify:`, departmentsToNotify)
      
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

      console.log(`Found ${usersToNotify.length} users to notify`)

      // Create notification message based on the action
      const notificationMessage = createNotificationMessage(data)
      console.log(`Notification message: ${notificationMessage}`)
      
      // First, delete existing notifications for this disbursement to prevent stacking
      await prisma.notification.deleteMany({
        where: {
          disbursementVoucherId: data.disbursementId,
          userId: {
            in: usersToNotify.map(user => user.id)
          }
        }
      })
      
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
    })()
    
    // Race between notification and timeout
    await Promise.race([notificationPromise, timeoutPromise])
    
  } catch (error) {
    console.error("Error sending workflow notifications:", error)
    // Don't throw the error, just log it
  }
}

function getDepartmentsToNotify(disbursementCreatedBy: UserRole, action: string): UserRole[] {
  // Base departments that should always be notified
  const baseDepartments: UserRole[] = ["ADMIN"]
  
  // Add requester's department
  baseDepartments.push(disbursementCreatedBy)
  
  // Add departments based on workflow type
  if (disbursementCreatedBy === "GSO") {
    // GSO workflow: Secretary, Mayor, BAC, Budget, Accounting, Treasury
    baseDepartments.push("SECRETARY", "MAYOR", "BAC", "BUDGET", "ACCOUNTING", "TREASURY")
  } else if (disbursementCreatedBy === "HR") {
    // HR workflow: Secretary, Mayor, Budget, Accounting, Treasury (BAC removed)
    baseDepartments.push("SECRETARY", "MAYOR", "BUDGET", "ACCOUNTING", "TREASURY")
  } else {
    // Standard workflow: Secretary, Mayor, Budget, Accounting, Treasury (BAC removed)
    baseDepartments.push("SECRETARY", "MAYOR", "BUDGET", "ACCOUNTING", "TREASURY")
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
      
    case "SECRETARY_REVIEW":
      return `Disbursement voucher "${payee}" (${formattedAmount}) has been reviewed by Secretary (${performedBy})`
      
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
    case "SECRETARY_REVIEW":
    case "REVIEW":
    case "BAC_REVIEW":
    case "BUDGET_REVIEW":
    case "ACCOUNTING_REVIEW":
      return "medium"
    default:
      return "low"
  }
}

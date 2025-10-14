import { prisma } from "@/lib/prisma"

interface CreateNotificationParams {
  type: string
  title: string
  message: string
  userId: string
  disbursementVoucherId?: string
  priority?: "high" | "medium" | "low"
}

export async function createNotification({
  type,
  title,
  message,
  userId,
  disbursementVoucherId,
  priority = "medium"
}: CreateNotificationParams) {
  try {
    await prisma.notification.create({
      data: {
        type,
        title,
        message,
        userId,
        disbursementVoucherId,
        priority
      }
    })
  } catch (error) {
    console.error("Error creating notification:", error)
  }
}

export async function notifySourceOffices(
  sourceOffices: string[],
  disbursementVoucher: {
    id: string
    payee: string
    amount: number
    createdBy: { name: string }
  }
) {
  // Map office names back to roles to find users
  const officeToRoleMap: Record<string, string> = {
    'General Services Office': 'GSO',
    'Bids and Awards Committee': 'BAC',
    'Mayor\'s Office': 'MAYOR',
    'Treasury Office': 'TREASURY',
    'Budget Office': 'BUDGET',
    'Accounting Office': 'ACCOUNTING',
    'Human Resources Office': 'HR',
    'Finance Office': 'FINANCE_HEAD',
    'Department Head Office': 'DEPARTMENT_HEAD',
    'Administrative Office': 'ADMIN',
    'Requesting Office': 'REQUESTER'
  }

  for (const office of sourceOffices) {
    const role = officeToRoleMap[office]
    if (!role) continue

    // Find users with this role
    const users = await prisma.user.findMany({
      where: {
        role: role as any,
        isActive: true
      }
    })

    // Create notifications for each user in this office
    for (const user of users) {
      await createNotification({
        type: "voucher_created",
        title: "New Disbursement Voucher Created",
        message: `A new disbursement voucher for ${disbursementVoucher.payee} (₱${disbursementVoucher.amount.toLocaleString()}) has been created by ${disbursementVoucher.createdBy.name} and your office (${office}) has been listed as a source office.`,
        userId: user.id,
        disbursementVoucherId: disbursementVoucher.id,
        priority: "medium"
      })
    }
  }
}

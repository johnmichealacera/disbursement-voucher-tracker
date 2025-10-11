import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  disbursementId: string
  disbursementTitle: string
  createdAt: string
  priority: "high" | "medium" | "low"
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const notifications: Notification[] = []
    const userRole = session.user.role

    // Get disbursements that need attention based on user role
    switch (userRole) {
      case "DEPARTMENT_HEAD":
        // Level 1 approvals needed
        const pendingForDeptHead = await prisma.disbursementVoucher.findMany({
          where: {
            status: "PENDING",
            approvals: {
              none: {
                level: 1,
                status: "APPROVED"
              }
            }
          },
          include: {
            createdBy: {
              select: { name: true, department: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        })

        pendingForDeptHead.forEach(voucher => {
          notifications.push({
            id: `dept-${voucher.id}`,
            type: "approval_needed",
            title: "Validation Required",
            message: `${voucher.title} from ${voucher.createdBy.name} needs validation`,
            disbursementId: voucher.id,
            disbursementTitle: voucher.title,
            createdAt: voucher.createdAt.toISOString(),
            priority: "high"
          })
        })
        break

      case "FINANCE_HEAD":
      case "ACCOUNTING":
        // Level 2 approvals needed (after level 1 is approved)
        const pendingForFinance = await prisma.disbursementVoucher.findMany({
          where: {
            status: "VALIDATED",
            approvals: {
              some: {
                level: 1,
                status: "APPROVED"
              },
              none: {
                level: 2,
                status: "APPROVED"
              }
            }
          },
          include: {
            createdBy: {
              select: { name: true, department: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        })

        pendingForFinance.forEach(voucher => {
          notifications.push({
            id: `finance-${voucher.id}`,
            type: "approval_needed",
            title: "Approval Required",
            message: `${voucher.title} from ${voucher.createdBy.name} needs approval`,
            disbursementId: voucher.id,
            disbursementTitle: voucher.title,
            createdAt: voucher.createdAt.toISOString(),
            priority: "high"
          })
        })
        break

      case "MAYOR":
        // Level 3 approvals needed (after levels 1 & 2 are approved)
        const pendingForMayor = await prisma.disbursementVoucher.findMany({
          where: {
            status: "APPROVED",
            approvals: {
              some: {
                level: 1,
                status: "APPROVED"
              }
            }
          },
          include: {
            createdBy: {
              select: { name: true, department: true }
            },
            approvals: {
              where: { level: 2, status: "APPROVED" }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        })

        // Filter to only include those with level 2 approved
        const mayorApprovals = pendingForMayor.filter(voucher => 
          voucher.approvals.length > 0
        )

        mayorApprovals.forEach(voucher => {
          notifications.push({
            id: `mayor-${voucher.id}`,
            type: "final_approval_needed",
            title: "Final Approval Required",
            message: `${voucher.title} from ${voucher.createdBy.name} needs final approval`,
            disbursementId: voucher.id,
            disbursementTitle: voucher.title,
            createdAt: voucher.createdAt.toISOString(),
            priority: "high"
          })
        })
        break

      case "TREASURY":
        // Approved vouchers ready for release
        const readyForRelease = await prisma.disbursementVoucher.findMany({
          where: {
            status: "APPROVED",
            approvals: {
              some: {
                level: 3,
                status: "APPROVED"
              }
            }
          },
          include: {
            createdBy: {
              select: { name: true, department: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        })

        readyForRelease.forEach(voucher => {
          notifications.push({
            id: `treasury-${voucher.id}`,
            type: "ready_for_release",
            title: "Ready for Release",
            message: `${voucher.title} is approved and ready for disbursement`,
            disbursementId: voucher.id,
            disbursementTitle: voucher.title,
            createdAt: voucher.createdAt.toISOString(),
            priority: "medium"
          })
        })
        break

      case "REQUESTER":
        // Get user's own vouchers with status updates
        const userVouchers = await prisma.disbursementVoucher.findMany({
          where: {
            createdById: session.user.id,
            status: {
              in: ["VALIDATED", "APPROVED", "RELEASED", "REJECTED"]
            }
          },
          include: {
            approvals: {
              orderBy: { createdAt: "desc" },
              take: 1
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 10
        })

        userVouchers.forEach(voucher => {
          let title = ""
          let message = ""
          let priority: "high" | "medium" | "low" = "medium"

          switch (voucher.status) {
            case "VALIDATED":
              title = "Voucher Validated"
              message = `Your request "${voucher.title}" has been validated`
              priority = "medium"
              break
            case "APPROVED":
              title = "Voucher Approved"
              message = `Your request "${voucher.title}" has been approved`
              priority = "medium"
              break
            case "RELEASED":
              title = "Voucher Released"
              message = `Your request "${voucher.title}" has been released`
              priority = "low"
              break
            case "REJECTED":
              title = "Voucher Rejected"
              message = `Your request "${voucher.title}" has been rejected`
              priority = "high"
              break
          }

          notifications.push({
            id: `requester-${voucher.id}`,
            type: "status_update",
            title,
            message,
            disbursementId: voucher.id,
            disbursementTitle: voucher.title,
            createdAt: voucher.updatedAt.toISOString(),
            priority
          })
        })
        break

      case "ADMIN":
        // Get all pending items across all levels
        const allPending = await prisma.disbursementVoucher.findMany({
          where: {
            status: {
              in: ["PENDING", "VALIDATED", "APPROVED"]
            }
          },
          include: {
            createdBy: {
              select: { name: true, department: true }
            },
            approvals: true
          },
          orderBy: { createdAt: "desc" },
          take: 15
        })

        allPending.forEach(voucher => {
          let title = ""
          let message = ""
          
          if (voucher.status === "PENDING") {
            title = "Validation Needed"
            message = `${voucher.title} needs validation`
          } else if (voucher.status === "VALIDATED") {
            title = "Approval Needed"
            message = `${voucher.title} needs approval`
          } else if (voucher.status === "APPROVED") {
            title = "Final Approval Needed"
            message = `${voucher.title} needs final approval`
          }

          notifications.push({
            id: `admin-${voucher.id}`,
            type: "admin_overview",
            title,
            message,
            disbursementId: voucher.id,
            disbursementTitle: voucher.title,
            createdAt: voucher.createdAt.toISOString(),
            priority: "medium"
          })
        })
        break
    }

    // Sort notifications by priority and date
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    notifications.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return NextResponse.json({
      notifications: notifications.slice(0, 20), // Limit to 20 most important
      unreadCount: notifications.filter(n => n.priority === "high").length
    })

  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

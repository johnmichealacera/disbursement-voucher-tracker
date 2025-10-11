import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface Notification {
  id: string
  type?: string
  title: string
  message: string
  status?: string
  timestamp?: Date
  actionType?: string
  read?: boolean
  disbursementId: string
  disbursementTitle?: string
  createdAt?: string
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
        // Get vouchers from GSO, HR, and regular offices for review
        const mayorReviewVouchers = await prisma.disbursementVoucher.findMany({
          where: {
            createdBy: {
              role: {
                in: ["GSO", "HR", "REQUESTER"]
              }
            },
            status: {
              in: ["PENDING", "VALIDATED", "APPROVED"]
            },
            // Exclude vouchers already reviewed by this Mayor
            NOT: {
              auditTrails: {
                some: {
                  action: "REVIEW",
                  userId: session.user.id
                }
              }
            }
          },
          include: {
            createdBy: { select: { name: true, role: true, department: true } }
          },
          orderBy: { updatedAt: "desc" },
          take: 10
        })

        mayorReviewVouchers.forEach(dv => {
          let message = `Voucher "${dv.title}" from ${dv.createdBy.department || dv.createdBy.role} is available for review.`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let priority: any = "medium"
          const actionType = "Review Required"

          if (dv.status === "PENDING") {
            message = `New voucher "${dv.title}" from ${dv.createdBy.department || dv.createdBy.role} submitted for review.`
            priority = "high"
          } else if (dv.status === "APPROVED") {
            message = `Voucher "${dv.title}" from ${dv.createdBy.department || dv.createdBy.role} has been approved and ready for final review.`
            priority = "high"
          }

          notifications.push({
            id: `mayor-${dv.id}-${dv.updatedAt.getTime()}`,
            disbursementId: dv.id,
            title: dv.title,
            message: message,
            status: dv.status,
            timestamp: dv.updatedAt,
            priority: priority,
            actionType: actionType,
            read: false
          })
        })
        break

      case "BAC":
        // Get all GSO vouchers and filter in application logic
        const allGsoVouchers = await prisma.disbursementVoucher.findMany({
          where: {
            createdBy: {
              role: "GSO"
            },
            status: {
              in: ["PENDING", "VALIDATED", "APPROVED"]
            },
            // Exclude vouchers already reviewed by this BAC member
            NOT: {
              auditTrails: {
                some: {
                  action: "BAC_REVIEW",
                  userId: session.user.id
                }
              }
            }
          },
          include: {
            createdBy: { select: { name: true, role: true, department: true } },
            auditTrails: {
              include: { user: { select: { role: true } } },
              where: { action: "REVIEW" }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 10
        })

        // Filter to only include vouchers reviewed by Mayor
        const bacReviewVouchers = allGsoVouchers.filter(voucher => 
          voucher.auditTrails.some(trail => 
            trail.action === "REVIEW" && trail.user.role === "MAYOR"
          )
        )

        bacReviewVouchers.forEach(dv => {
          const message = `GSO voucher "${dv.title}" has been reviewed by Mayor and is ready for BAC review.`
          const priority = "high"
          const actionType = "BAC Review Required"

          notifications.push({
            id: `bac-${dv.id}-${dv.updatedAt.getTime()}`,
            disbursementId: dv.id,
            title: dv.title,
            message: message,
            status: dv.status,
            timestamp: dv.updatedAt,
            priority: priority,
            actionType: actionType,
            read: false
          })
        })
        break

      case "BUDGET":
        // Get all GSO vouchers and filter in application logic
        const allGsoBudgetVouchers = await prisma.disbursementVoucher.findMany({
          where: {
            createdBy: {
              role: "GSO"
            },
            status: {
              in: ["PENDING", "VALIDATED", "APPROVED"]
            },
            // Exclude vouchers already reviewed by this Budget member
            NOT: {
              auditTrails: {
                some: {
                  action: "BUDGET_REVIEW",
                  userId: session.user.id
                }
              }
            }
          },
          include: {
            createdBy: { select: { name: true, role: true, department: true } },
            auditTrails: {
              include: { user: { select: { role: true } } },
              where: { action: { in: ["BAC_REVIEW"] } }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 10
        })

        // Filter to only include vouchers reviewed by BAC
        const budgetReviewVouchers = allGsoBudgetVouchers.filter(voucher => 
          voucher.auditTrails.some(trail => 
            trail.action === "BAC_REVIEW" && trail.user.role === "BAC"
          )
        )

        budgetReviewVouchers.forEach(dv => {
          const message = `GSO voucher "${dv.title}" has been reviewed by BAC and is ready for Budget Office review.`
          const priority = "high"
          const actionType = "Budget Review Required"

          notifications.push({
            id: `budget-${dv.id}-${dv.updatedAt.getTime()}`,
            disbursementId: dv.id,
            title: dv.title,
            message: message,
            status: dv.status,
            timestamp: dv.updatedAt,
            priority: priority,
            actionType: actionType,
            read: false
          })
        })
        break

      case "TREASURY":
        // Get all GSO vouchers and filter in application logic
        const allGsoTreasuryVouchers = await prisma.disbursementVoucher.findMany({
          where: {
            createdBy: {
              role: "GSO"
            },
            status: {
              in: ["PENDING", "VALIDATED", "APPROVED"]
            },
            // Exclude vouchers already reviewed by this Treasury member
            NOT: {
              auditTrails: {
                some: {
                  action: "TREASURY_REVIEW",
                  userId: session.user.id
                }
              }
            }
          },
          include: {
            createdBy: { select: { name: true, role: true, department: true } },
            auditTrails: {
              include: { user: { select: { role: true } } },
              where: { action: { in: ["ACCOUNTING_REVIEW"] } }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 10
        })

        // Filter to only include vouchers reviewed by Accounting
        const treasuryReviewVouchers = allGsoTreasuryVouchers.filter(voucher => 
          voucher.auditTrails.some(trail => 
            trail.action === "ACCOUNTING_REVIEW" && trail.user.role === "ACCOUNTING"
          )
        )

        treasuryReviewVouchers.forEach(dv => {
          const message = `GSO voucher "${dv.title}" has been reviewed by Accounting and is ready for Treasury review.`
          const priority = "high"
          const actionType = "Treasury Review Required"

          notifications.push({
            id: `treasury-${dv.id}-${dv.updatedAt.getTime()}`,
            disbursementId: dv.id,
            title: dv.title,
            message: message,
            status: dv.status,
            timestamp: dv.updatedAt,
            priority: priority,
            actionType: actionType,
            read: false
          })
        })

        // Also include existing approved vouchers ready for release (original functionality)
        const readyForRelease = await prisma.disbursementVoucher.findMany({
          where: {
            status: "APPROVED",
            NOT: {
              createdBy: {
                role: "GSO" // Exclude GSO vouchers as they have their own workflow
              }
            }
          },
          include: {
            createdBy: { select: { name: true, department: true } }
          },
          orderBy: { updatedAt: "desc" },
          take: 5
        })

        readyForRelease.forEach(dv => {
          notifications.push({
            id: `treasury-release-${dv.id}-${dv.updatedAt.getTime()}`,
            disbursementId: dv.id,
            title: dv.title,
            message: `Voucher "${dv.title}" is approved and ready for release.`,
            status: dv.status,
            timestamp: dv.updatedAt,
            priority: "medium",
            actionType: "Ready for Release",
            read: false
          })
        })
        break

      case "ACCOUNTING":
        // Get all GSO vouchers and filter in application logic
        const allGsoAccountingVouchers = await prisma.disbursementVoucher.findMany({
          where: {
            createdBy: {
              role: "GSO"
            },
            status: {
              in: ["PENDING", "VALIDATED", "APPROVED"]
            },
            // Exclude vouchers already reviewed by this Accounting member
            NOT: {
              auditTrails: {
                some: {
                  action: "ACCOUNTING_REVIEW",
                  userId: session.user.id
                }
              }
            }
          },
          include: {
            createdBy: { select: { name: true, role: true, department: true } },
            auditTrails: {
              include: { user: { select: { role: true } } },
              where: { action: { in: ["BUDGET_REVIEW"] } }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 10
        })

        // Filter to only include vouchers reviewed by Budget Office
        const accountingReviewVouchers = allGsoAccountingVouchers.filter(voucher => 
          voucher.auditTrails.some(trail => 
            trail.action === "BUDGET_REVIEW" && trail.user.role === "BUDGET"
          )
        )

        accountingReviewVouchers.forEach(dv => {
          const message = `GSO voucher "${dv.title}" has been reviewed by Budget Office and is ready for Accounting review.`
          const priority = "high"
          const actionType = "Accounting Review Required"

          notifications.push({
            id: `accounting-${dv.id}-${dv.updatedAt.getTime()}`,
            disbursementId: dv.id,
            title: dv.title,
            message: message,
            status: dv.status,
            timestamp: dv.updatedAt,
            priority: priority,
            actionType: actionType,
            read: false
          })
        })
        break

      case "REQUESTER":
      case "GSO":
      case "HR":
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
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

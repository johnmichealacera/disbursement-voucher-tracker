import { NextResponse } from "next/server"
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const notifications: Notification[] = []
    const userRole = session.user.role

    // Get stored notifications from database (only unread ones)
    const storedNotifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        isRead: false // Only show unread notifications
      },
      include: {
        disbursementVoucher: {
          select: {
            id: true,
            payee: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    })

    // Add stored notifications to the list
    storedNotifications.forEach(notification => {
      notifications.push({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        disbursementId: notification.disbursementVoucherId || "",
        disbursementTitle: notification.disbursementVoucher?.payee || undefined,
        createdAt: notification.createdAt.toISOString(),
        priority: notification.priority as "high" | "medium" | "low"
      })
    })

    // Get disbursements that need attention based on user role
    switch (userRole) {
      case "MAYOR":
        // Mayor needs to review non-GSO vouchers first
        const pendingForMayor = await prisma.disbursementVoucher.findMany({
          where: {
            status: "PENDING",
            createdBy: {
              role: {
                in: ["REQUESTER", "HR"]
              }
            },
            approvals: {
              none: {
                level: 1,
                status: "APPROVED"
              }
            }
          },
          select: {
            id: true,
            payee: true,
            createdAt: true,
            createdBy: {
              select: { name: true, department: true, role: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        })

        pendingForMayor.forEach(voucher => {
          notifications.push({
            id: `mayor-${voucher.id}`,
            type: "approval_needed",
            title: "Mayor Review Required",
            message: `${voucher.payee} from ${voucher.createdBy.name} (${voucher.createdBy.role}) needs Mayor review`,
            disbursementId: voucher.id,
            disbursementTitle: voucher.payee,
            createdAt: voucher.createdAt.toISOString(),
            priority: "high"
          })
        })
        break

      case "BUDGET":
        // Budget needs to review after Mayor approval
        const pendingForBudget = await prisma.disbursementVoucher.findMany({
          where: {
            status: "PENDING",
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
          select: {
            id: true,
            payee: true,
            createdAt: true,
            createdBy: {
              select: { name: true, department: true, role: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        })

        pendingForBudget.forEach(voucher => {
          notifications.push({
            id: `budget-${voucher.id}`,
            type: "approval_needed",
            title: "Budget Review Required",
            message: `${voucher.payee} from ${voucher.createdBy.name} (${voucher.createdBy.role}) needs Budget review`,
            disbursementId: voucher.id,
            disbursementTitle: voucher.payee,
            createdAt: voucher.createdAt.toISOString(),
            priority: "high"
          })
        })
        break

      case "ACCOUNTING":
        // Accounting needs to review after Budget approval
        const pendingForAccounting = await prisma.disbursementVoucher.findMany({
          where: {
            status: "PENDING",
            approvals: {
              some: {
                level: 2,
                status: "APPROVED"
              },
              none: {
                level: 3,
                status: "APPROVED"
              }
            }
          },
          select: {
            id: true,
            payee: true,
            createdAt: true,
            createdBy: {
              select: { name: true, department: true, role: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        })

        pendingForAccounting.forEach(voucher => {
          notifications.push({
            id: `accounting-${voucher.id}`,
            type: "approval_needed",
            title: "Accounting Review Required",
            message: `${voucher.payee} from ${voucher.createdBy.name} (${voucher.createdBy.role}) needs Accounting review`,
            disbursementId: voucher.id,
            disbursementTitle: voucher.payee,
            createdAt: voucher.createdAt.toISOString(),
            priority: "high"
          })
        })
        break


      case "BAC":
        // Get GSO vouchers that need BAC review (after Mayor approval)
        const gsoVouchersForBac = await prisma.disbursementVoucher.findMany({
          where: {
            createdBy: {
              role: "GSO"
            },
            status: {
              in: ["PENDING", "VALIDATED", "APPROVED"]
            },
            approvals: {
              // Must have Mayor approval (Level 1)
              some: {
                level: 1,
                status: "APPROVED"
              },
              // Must not have BAC completion (Level 2)
              none: {
                level: 2,
                status: "APPROVED"
              }
            },
            // Exclude vouchers already reviewed by this BAC member
            NOT: {
              bacReviews: {
                some: {
                  reviewerId: session.user.id
                }
              }
            }
          },
          include: {
            createdBy: { select: { name: true, role: true, department: true } },
            bacReviews: {
              include: { reviewer: { select: { name: true } } }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 10
        })

        gsoVouchersForBac.forEach(dv => {
          const currentReviews = dv.bacReviews.length
          const requiredReviews = 3
          const remainingReviews = requiredReviews - currentReviews
          
          let message = ""
          let priority: "high" | "medium" | "low" = "high"
          
          if (currentReviews === 0) {
            message = `GSO voucher "${dv.payee}" needs BAC review. No reviews yet.`
            priority = "high"
          } else if (currentReviews < requiredReviews) {
            message = `GSO voucher "${dv.payee}" has ${currentReviews}/5 BAC reviews. Need ${remainingReviews} more reviews.`
            priority = "medium"
          } else {
            message = `GSO voucher "${dv.payee}" has sufficient BAC reviews (${currentReviews}/5).`
            priority = "low"
          }

          notifications.push({
            id: `bac-${dv.id}-${dv.updatedAt.getTime()}`,
            disbursementId: dv.id,
            title: dv.payee,
            message: message,
            status: dv.status,
            timestamp: dv.updatedAt,
            priority: priority,
            actionType: "BAC Review Required",
            read: false
          })
        })
        break


      case "TREASURY":
        // Treasury needs to review after Accounting approval
        const pendingForTreasury = await prisma.disbursementVoucher.findMany({
          where: {
            status: "PENDING",
            approvals: {
              some: {
                level: 3,
                status: "APPROVED"
              },
              none: {
                level: 4,
                status: "APPROVED"
              }
            }
          },
          select: {
            id: true,
            payee: true,
            createdAt: true,
            createdBy: {
              select: { name: true, department: true, role: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        })

        pendingForTreasury.forEach(voucher => {
          notifications.push({
            id: `treasury-${voucher.id}`,
            type: "approval_needed",
            title: "Treasury Review Required",
            message: `${voucher.payee} from ${voucher.createdBy.name} (${voucher.createdBy.role}) needs Treasury review`,
            disbursementId: voucher.id,
            disbursementTitle: voucher.payee,
            createdAt: voucher.createdAt.toISOString(),
            priority: "high"
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
          select: {
            id: true,
            payee: true,
            status: true,
            updatedAt: true,
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
              message = `Your request "${voucher.payee}" has been validated`
              priority = "medium"
              break
            case "APPROVED":
              title = "Voucher Approved"
              message = `Your request "${voucher.payee}" has been approved`
              priority = "medium"
              break
            case "RELEASED":
              title = "Voucher Released"
              message = `Your request "${voucher.payee}" has been released`
              priority = "low"
              break
            case "REJECTED":
              title = "Voucher Rejected"
              message = `Your request "${voucher.payee}" has been rejected`
              priority = "high"
              break
          }

          notifications.push({
            id: `requester-${voucher.id}`,
            type: "status_update",
            title,
            message,
            disbursementId: voucher.id,
            disbursementTitle: voucher.payee,
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
          select: {
            id: true,
            payee: true,
            status: true,
            createdAt: true,
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
            message = `${voucher.payee} needs validation`
          } else if (voucher.status === "VALIDATED") {
            title = "Approval Needed"
            message = `${voucher.payee} needs approval`
          } else if (voucher.status === "APPROVED") {
            title = "Final Approval Needed"
            message = `${voucher.payee} needs final approval`
          }

          notifications.push({
            id: `admin-${voucher.id}`,
            type: "admin_overview",
            title,
            message,
            disbursementId: voucher.id,
            disbursementTitle: voucher.payee,
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

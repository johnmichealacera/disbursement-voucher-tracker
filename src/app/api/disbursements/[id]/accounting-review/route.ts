import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { sendWorkflowNotifications } from "@/lib/workflow-notifications"

const accountingReviewSchema = z.object({
  action: z.enum(["ACCOUNTING_REVIEWED"]),
  comments: z.string().optional()
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Accounting can review vouchers
    if (session.user.role !== "ACCOUNTING") {
      return NextResponse.json({ error: "Only Accounting department can review vouchers" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = accountingReviewSchema.parse(body)

    // Get the disbursement
    const disbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, role: true, department: true } },
        items: true,
        auditTrails: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { timestamp: "desc" }
        }
      }
    })

    if (!disbursement) {
      return NextResponse.json({ error: "Disbursement not found" }, { status: 404 })
    }

    // Check if voucher is in a reviewable status
    const reviewableStatuses = ["PENDING", "VALIDATED", "APPROVED"]
    if (!reviewableStatuses.includes(disbursement.status)) {
      return NextResponse.json({ 
        error: `Cannot review voucher with status ${disbursement.status}` 
      }, { status: 400 })
    }

    // Check prerequisites based on workflow type
    if (disbursement.createdBy.role === "GSO") {
      // For GSO workflow: check if BAC has reviewed (3+ reviews) and Budget has approved (Level 4)
      const bacReviewCount = await prisma.bacReview.count({
        where: { disbursementVoucherId: id }
      })
      
      if (bacReviewCount < 3) {
        return NextResponse.json({ 
          error: "Accounting can only review GSO vouchers after BAC has completed 3+ reviews" 
        }, { status: 400 })
      }

      const budgetHasApproved = await prisma.approval.findFirst({
        where: {
          disbursementVoucherId: id,
          level: 4,
          status: "APPROVED"
        }
      })
      
      if (!budgetHasApproved) {
        return NextResponse.json({ 
          error: "Accounting can only review GSO vouchers after Budget has approved" 
        }, { status: 400 })
      }
    } else {
      // For non-GSO workflow: check if Budget has approved (Level 3)
      const budgetHasApproved = await prisma.approval.findFirst({
        where: {
          disbursementVoucherId: id,
          level: 3,
          status: "APPROVED"
        }
      })
      
      if (!budgetHasApproved) {
        return NextResponse.json({ 
          error: "Accounting can only review non-GSO vouchers after Budget has approved" 
        }, { status: 400 })
      }
    }

    // Check if Accounting has already reviewed this voucher
    const accountingLevel = disbursement.createdBy.role === "GSO" ? 5 : 4 // Level 5 for GSO, Level 4 for non-GSO
    const accountingHasReviewed = await prisma.approval.findFirst({
      where: {
        disbursementVoucherId: id,
        level: accountingLevel,
        status: "APPROVED"
      }
    })

    if (accountingHasReviewed) {
      return NextResponse.json({ 
        error: "Accounting has already reviewed this voucher" 
      }, { status: 400 })
    }

    // Create the approval record for Accounting
    const approval = await prisma.approval.create({
      data: {
        approverId: session.user.id,
        disbursementVoucherId: id,
        status: "APPROVED",
        remarks: validatedData.comments,
        level: accountingLevel, // Level 5 for GSO, Level 4 for non-GSO
        approvedAt: new Date()
      },
      include: {
        approver: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    })

    // Create audit trail for the Accounting review
    await prisma.auditTrail.create({
      data: {
        action: "ACCOUNTING_REVIEW",
        entityType: "DisbursementVoucher",
        entityId: disbursement.id,
        oldValues: { status: disbursement.status },
        newValues: { 
          status: disbursement.status,
          accountingReviewedBy: session.user.name,
          accountingReviewComments: validatedData.comments 
        },
        userId: session.user.id,
        disbursementVoucherId: disbursement.id
      }
    })

    // Send workflow notifications
    await sendWorkflowNotifications({
      disbursementId: disbursement.id,
      payee: disbursement.payee,
      amount: Number(disbursement.amount),
      action: "ACCOUNTING_REVIEW",
      performedBy: session.user.name,
      performedByRole: "ACCOUNTING",
      disbursementCreatedBy: disbursement.createdBy.role,
      remarks: validatedData.comments
    })

    // Get updated disbursement with all relations
    const updatedDisbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, department: true, role: true } },
        items: true,
        approvals: { 
          include: { approver: { select: { id: true, name: true, role: true } } }, 
          orderBy: { level: "asc" } 
        },
        auditTrails: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { timestamp: "desc" }
        }
      }
    })

    return NextResponse.json({
      approval,
      disbursement: updatedDisbursement,
      message: "Accounting review completed successfully"
    }, { status: 200 })
  } catch (error) {
    console.error("Error Accounting reviewing disbursement:", error)
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ error: "Invalid request data", details: (error as any).errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

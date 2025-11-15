import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { sendWorkflowNotifications } from "@/lib/workflow-notifications"
import { getBacRequiredApprovals } from "@/lib/settings"

const budgetReviewSchema = z.object({
  action: z.enum(["BUDGET_REVIEWED"]),
  remarks: z.string().optional()
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

    // Only Budget Office can review vouchers
    if (session.user.role !== "BUDGET") {
      return NextResponse.json({ error: "Only Budget Office can review vouchers" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = budgetReviewSchema.parse(body)

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
      // For GSO workflow: check if BAC has reviewed (required reviews)
      const bacReviewCount = await prisma.bacReview.count({
        where: { disbursementVoucherId: id }
      })
      const requiredBacReviews = await getBacRequiredApprovals()
      
      if (bacReviewCount < requiredBacReviews) {
        return NextResponse.json({ 
          error: `Budget Office can only review GSO vouchers after BAC has completed ${requiredBacReviews}+ reviews` 
        }, { status: 400 })
      }
    } else {
      // For non-GSO workflow: check if Mayor has approved (Level 2)
      const mayorHasApproved = await prisma.approval.findFirst({
        where: {
          disbursementVoucherId: id,
          level: 2,
          status: "APPROVED"
        }
      })
      
      if (!mayorHasApproved) {
        return NextResponse.json({ 
          error: "Budget Office can only review non-GSO vouchers after Mayor has approved" 
        }, { status: 400 })
      }
    }

    // Check if Budget has already reviewed this voucher
    const budgetLevel = disbursement.createdBy.role === "GSO" ? 4 : 3 // Level 4 for GSO, Level 3 for non-GSO
    const budgetHasReviewed = await prisma.approval.findFirst({
      where: {
        disbursementVoucherId: id,
        level: budgetLevel,
        status: "APPROVED"
      }
    })

    if (budgetHasReviewed) {
      return NextResponse.json({ 
        error: "Budget Office has already reviewed this voucher" 
      }, { status: 400 })
    }

    // Create the approval record for Budget
    const approval = await prisma.approval.create({
      data: {
        approverId: session.user.id,
        disbursementVoucherId: id,
        status: "APPROVED",
        remarks: validatedData.remarks,
        level: budgetLevel, // Level 4 for GSO, Level 3 for non-GSO
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

    // Create audit trail for the Budget review
    await prisma.auditTrail.create({
      data: {
        action: "BUDGET_REVIEW",
        entityType: "DisbursementVoucher",
        entityId: disbursement.id,
        oldValues: { status: disbursement.status },
        newValues: { 
          status: disbursement.status, // Status doesn't change, just reviewed
          budgetReviewedBy: session.user.name,
          budgetReviewComments: validatedData.remarks 
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
      action: "BUDGET_REVIEW",
      performedBy: session.user.name,
      performedByRole: "BUDGET",
      disbursementCreatedBy: disbursement.createdBy.role,
      remarks: validatedData.remarks
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

    return NextResponse.json(updatedDisbursement, { status: 200 })
  } catch (error) {
    console.error("Error Budget reviewing disbursement:", error)
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ error: "Invalid request data", details: (error as any).errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

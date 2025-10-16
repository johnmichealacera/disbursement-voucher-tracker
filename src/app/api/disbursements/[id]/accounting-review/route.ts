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

    // Check if voucher is from GSO
    if (disbursement.createdBy.role !== "GSO") {
      return NextResponse.json({ 
        error: "Accounting can only review vouchers from GSO department" 
      }, { status: 403 })
    }

    // Check if voucher is in a reviewable status
    const reviewableStatuses = ["PENDING", "VALIDATED", "APPROVED"]
    if (!reviewableStatuses.includes(disbursement.status)) {
      return NextResponse.json({ 
        error: `Cannot review voucher with status ${disbursement.status}` 
      }, { status: 400 })
    }

    // Check if Budget Office has already reviewed this voucher
    const budgetHasReviewed = disbursement.auditTrails.some(trail => 
      trail.action === "BUDGET_REVIEW" && trail.user.role === "BUDGET"
    )

    if (!budgetHasReviewed) {
      return NextResponse.json({ 
        error: "Accounting can only review GSO vouchers after Budget Office has reviewed them" 
      }, { status: 400 })
    }

    // Create audit trail for the Accounting review
    await prisma.auditTrail.create({
      data: {
        action: "ACCOUNTING_REVIEW",
        entityType: "DisbursementVoucher",
        entityId: disbursement.id,
        oldValues: { status: disbursement.status },
        newValues: { 
          status: disbursement.status, // Status doesn't change, just reviewed
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

    return NextResponse.json(updatedDisbursement, { status: 200 })
  } catch (error) {
    console.error("Error Accounting reviewing disbursement:", error)
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ error: "Invalid request data", details: (error as any).errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

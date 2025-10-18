import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { sendWorkflowNotifications } from "@/lib/workflow-notifications"

const bacReviewSchema = z.object({
  action: z.enum(["BAC_REVIEWED"]),
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

    // Only BAC can review vouchers
    if (session.user.role !== "BAC") {
      return NextResponse.json({ error: "Only BAC members can review vouchers" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = bacReviewSchema.parse(body)

    // Get the disbursement
    const disbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, role: true, department: true } },
        items: true,
        approvals: { 
          include: { approver: { select: { id: true, name: true, role: true } } }, 
          orderBy: { level: "asc" } 
        },
        bacReviews: {
          include: { reviewer: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "desc" }
        },
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
        error: "BAC can only review vouchers from GSO department" 
      }, { status: 403 })
    }

    // Check if voucher is in a reviewable status
    const reviewableStatuses = ["PENDING", "VALIDATED", "APPROVED"]
    if (!reviewableStatuses.includes(disbursement.status)) {
      return NextResponse.json({ 
        error: `Cannot review voucher with status ${disbursement.status}` 
      }, { status: 400 })
    }

    // Check if Mayor has already reviewed this voucher (using approval levels OR audit trails)
    const mayorHasReviewedByApproval = disbursement.approvals && disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED"
    )
    
    const mayorHasReviewedByAudit = disbursement.auditTrails && disbursement.auditTrails.some(trail => 
      trail.action === "REVIEW" && trail.user.role === "MAYOR"
    )
    
    const mayorHasReviewed = mayorHasReviewedByApproval || mayorHasReviewedByAudit

    // Debug logging
    console.log("BAC Review Debug:", {
      disbursementId: disbursement.id,
      disbursementStatus: disbursement.status,
      disbursementRole: disbursement.createdBy.role,
      approvals: disbursement.approvals,
      auditTrails: disbursement.auditTrails,
      mayorHasReviewedByApproval,
      mayorHasReviewedByAudit,
      mayorHasReviewed,
      bacReviews: disbursement.bacReviews,
      approvalLevel1: disbursement.approvals?.filter(a => a.level === 1),
      approvalLevel2: disbursement.approvals?.filter(a => a.level === 2)
    })

    if (!mayorHasReviewed) {
      return NextResponse.json({ 
        error: "BAC can only review GSO vouchers after Mayor has reviewed them" 
      }, { status: 400 })
    }

    // Check if this BAC member has already reviewed this voucher
    const existingReview = disbursement.bacReviews.find(review => 
      review.reviewerId === session.user.id
    )

    if (existingReview) {
      return NextResponse.json({ 
        error: "You have already reviewed this disbursement voucher" 
      }, { status: 400 })
    }

    // Create BAC review record
    await prisma.bacReview.create({
      data: {
        status: "APPROVED", // BAC reviews are always approvals
        comments: validatedData.comments,
        reviewerId: session.user.id,
        disbursementVoucherId: disbursement.id,
        reviewedAt: new Date()
      }
    })

    // Count total BAC reviews for this disbursement
    const totalBacReviews = disbursement.bacReviews.length + 1 // +1 for the one we just created
    const requiredReviews = 3

    // Create audit trail for the BAC review
    await prisma.auditTrail.create({
      data: {
        action: "BAC_REVIEW",
        entityType: "DisbursementVoucher",
        entityId: disbursement.id,
        oldValues: { status: disbursement.status },
        newValues: { 
          status: disbursement.status, // Status doesn't change, just reviewed
          bacReviewedBy: session.user.name,
          bacReviewComments: validatedData.comments,
          bacReviewCount: totalBacReviews,
          bacReviewRequired: requiredReviews
        },
        userId: session.user.id,
        disbursementVoucherId: disbursement.id
      }
    })

    // Check if we have reached the required number of BAC reviews (3 out of 5)
    if (totalBacReviews >= requiredReviews) {
      // BAC review is complete - no need to create approval level
      // Budget will create its own approval when it reviews

      // Send notification that BAC review is complete
      await sendWorkflowNotifications({
        disbursementId: disbursement.id,
        payee: disbursement.payee,
        amount: Number(disbursement.amount),
        action: "BAC_REVIEW_COMPLETE",
        performedBy: `${totalBacReviews} BAC Members`,
        performedByRole: "BAC",
        disbursementCreatedBy: disbursement.createdBy.role,
        remarks: `BAC review completed by ${totalBacReviews} out of 5 members`
      })
    }

    // Send workflow notifications
    await sendWorkflowNotifications({
      disbursementId: disbursement.id,
      payee: disbursement.payee,
      amount: Number(disbursement.amount),
      action: "BAC_REVIEW",
      performedBy: session.user.name,
      performedByRole: "BAC",
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
        bacReviews: {
          include: { reviewer: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "desc" }
        },
        auditTrails: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { timestamp: "desc" }
        }
      }
    })

    return NextResponse.json(updatedDisbursement, { status: 200 })
  } catch (error) {
    console.error("Error BAC reviewing disbursement:", error)
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ error: "Invalid request data", details: (error as any).errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

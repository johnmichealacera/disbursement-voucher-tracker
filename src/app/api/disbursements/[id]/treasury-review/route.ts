import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { sendWorkflowNotifications } from "@/lib/workflow-notifications"
import { VoucherStatus } from "@prisma/client"
import { getBacRequiredApprovals } from "@/lib/settings"

const treasuryReviewSchema = z.object({
  action: z.enum(["CHECK_ISSUANCE", "MARK_RELEASED"]),
  checkNumber: z.string().optional(),
  releaseRecipient: z.string().optional(),
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

    // Only Treasury can review vouchers
    if (session.user.role !== "TREASURY") {
      return NextResponse.json({ error: "Only Treasury Office can review vouchers" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = treasuryReviewSchema.parse(body)

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
        auditTrails: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { timestamp: "desc" }
        }
      }
    })

    if (!disbursement) {
      return NextResponse.json({ error: "Disbursement not found" }, { status: 404 })
    }

    // Handle different actions
    if (validatedData.action === "CHECK_ISSUANCE") {
      // Check prerequisites based on workflow type
      if (disbursement.createdBy.role === "GSO") {
        // For GSO workflow: check Secretary (Level 1), Mayor (Level 2), BAC (3+ reviews), Budget (Level 4), Accounting (Level 5)
        const secretaryApproved = disbursement.approvals.some(approval => 
          approval.level === 1 && approval.status === "APPROVED"
        )
        const mayorApproved = disbursement.approvals.some(approval => 
          approval.level === 2 && approval.status === "APPROVED"
        )
        const budgetApproved = disbursement.approvals.some(approval => 
          approval.level === 4 && approval.status === "APPROVED"
        )
        const accountingApproved = disbursement.approvals.some(approval => 
          approval.level === 5 && approval.status === "APPROVED"
        )
        
        const bacReviewCount = await prisma.bacReview.count({
          where: { disbursementVoucherId: id }
        })
        const requiredBacReviews = await getBacRequiredApprovals()
        const bacCompleted = bacReviewCount >= requiredBacReviews
        
        if (!secretaryApproved || !mayorApproved || !bacCompleted || !budgetApproved || !accountingApproved) {
          return NextResponse.json({ 
            error: "Treasury can only issue checks after all previous approvals are completed for GSO workflow" 
          }, { status: 400 })
        }
      } else {
        // For non-GSO workflow: check Secretary (Level 1), Mayor (Level 2), Budget (Level 3), Accounting (Level 4)
        const secretaryApproved = disbursement.approvals.some(approval => 
          approval.level === 1 && approval.status === "APPROVED"
        )
        const mayorApproved = disbursement.approvals.some(approval => 
          approval.level === 2 && approval.status === "APPROVED"
        )
        const budgetApproved = disbursement.approvals.some(approval => 
          approval.level === 3 && approval.status === "APPROVED"
        )
        const accountingApproved = disbursement.approvals.some(approval => 
          approval.level === 4 && approval.status === "APPROVED"
        )
        
        if (!secretaryApproved || !mayorApproved || !budgetApproved || !accountingApproved) {
          return NextResponse.json({ 
            error: "Treasury can only issue checks after all previous approvals are completed for non-GSO workflow" 
          }, { status: 400 })
        }
      }

      // Check if check number is provided
      if (!validatedData.checkNumber || validatedData.checkNumber.trim() === "") {
        return NextResponse.json({ 
          error: "Check number is required for check issuance" 
        }, { status: 400 })
      }
    }

    if (validatedData.action === "MARK_RELEASED") {
      if (!validatedData.releaseRecipient || validatedData.releaseRecipient.trim() === "") {
        return NextResponse.json({
          error: "Receiver name is required to mark the voucher as released"
        }, { status: 400 })
      }

      // For marking as released, check if it's ready for release
      if (disbursement.status !== "APPROVED" && !disbursement.checkNumber) {
        return NextResponse.json({ 
          error: "Voucher must be approved and have a check number before it can be released" 
        }, { status: 400 })
      }
    }

    // Update disbursement based on action
    let updateData: {
      checkNumber?: string
      status?: VoucherStatus
      releaseDate?: Date
      releaseRecipient?: string | null
    } = {}
    let auditAction = ""
    let auditMessage = ""

    if (validatedData.action === "CHECK_ISSUANCE") {
      updateData = {
        checkNumber: validatedData.checkNumber,
        status: "APPROVED" // Mark as approved when check is issued
      }
      auditAction = "CHECK_ISSUANCE"
      auditMessage = `Check issued with number: ${validatedData.checkNumber}`
    } else if (validatedData.action === "MARK_RELEASED") {
      updateData = {
        status: "RELEASED",
        releaseDate: new Date(),
        releaseRecipient: validatedData.releaseRecipient?.trim() ?? null
      }
      auditAction = "MARK_RELEASED"
      auditMessage = "Voucher marked as released"
    }

    // Update the disbursement
    await prisma.disbursementVoucher.update({
      where: { id },
      data: updateData
    })

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: auditAction,
        entityType: "DisbursementVoucher",
        entityId: disbursement.id,
        oldValues: { status: disbursement.status, checkNumber: disbursement.checkNumber },
        newValues: { 
          status: updateData.status,
          checkNumber: updateData.checkNumber,
          releaseDate: updateData.releaseDate,
          releaseRecipient: updateData.releaseRecipient,
          treasuryActionBy: session.user.name,
          treasuryActionComments: validatedData.remarks,
          actionMessage: auditMessage
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
      action: auditAction,
      performedBy: session.user.name,
      performedByRole: "TREASURY",
      disbursementCreatedBy: disbursement.createdBy.role,
      remarks: validatedData.remarks,
      checkNumber: updateData.checkNumber,
      releaseRecipient: updateData.releaseRecipient ?? undefined
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
    console.error("Error Treasury reviewing disbursement:", error)
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ error: "Invalid request data", details: (error as any).errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import { z } from "zod"
import { UserRole, VoucherStatus } from "@prisma/client"
import { sendWorkflowNotifications } from "@/lib/workflow-notifications"

const approvalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  remarks: z.string().optional()
})

// Define approval levels and required roles
const APPROVAL_LEVELS = {
  1: ["DEPARTMENT_HEAD"],
  2: ["FINANCE_HEAD", "ACCOUNTING"],
  3: ["MAYOR"],
  4: ["ADMIN"],
  5: ["REQUESTER"]
}

function getApprovalLevel(role: UserRole): number | null {
  for (const [level, roles] of Object.entries(APPROVAL_LEVELS)) {
    if (roles.includes(role)) {
      return parseInt(level)
    }
  }
  return null
}

function getNextVoucherStatus(level: number, approved: boolean): VoucherStatus {
  if (!approved) return "REJECTED"
  
  switch (level) {
    case 1: return "VALIDATED"
    case 2: return "APPROVED"
    default: return "PENDING"
  }
}

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

    const body = await request.json()
    const validatedData = approvalSchema.parse(body)

    // Get the disbursement
    const disbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
      include: {
        approvals: {
          orderBy: { level: "asc" }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    })

    if (!disbursement) {
      return NextResponse.json({ error: "Disbursement not found" }, { status: 404 })
    }

    // Check if user can approve at their level
    const userApprovalLevel = getApprovalLevel(session.user.role)
    if (!userApprovalLevel) {
      return NextResponse.json({ error: "You don't have approval permissions" }, { status: 403 })
    }

    // Check if disbursement is in the right status for approval
    if (!["PENDING", "VALIDATED"].includes(disbursement.status)) {
      return NextResponse.json({ error: "Disbursement is not ready for approval" }, { status: 400 })
    }

    // Check if user has already approved/rejected at this level
    const existingApproval = disbursement.approvals.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (approval: any) => approval.approverId === session.user.id && approval.level === userApprovalLevel
    )

    if (existingApproval) {
      return NextResponse.json({ error: "You have already processed this approval" }, { status: 400 })
    }

    // Check if previous levels are approved (except for level 1)
    if (userApprovalLevel > 1) {
      const previousLevels = Array.from({ length: userApprovalLevel - 1 }, (_, i) => i + 1)
      const previousApprovals = disbursement.approvals.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (approval: any) => previousLevels.includes(approval.level) && approval.status === "APPROVED"
      )
      
      if (previousApprovals.length !== previousLevels.length) {
        return NextResponse.json({ error: "Previous approval levels are not completed" }, { status: 400 })
      }
    }

    // Create the approval record
    const approval = await prisma.approval.create({
      data: {
        approverId: session.user.id,
        disbursementVoucherId: id,
        status: validatedData.status,
        remarks: validatedData.remarks,
        level: userApprovalLevel,
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

    // Update disbursement status
    const newStatus = getNextVoucherStatus(userApprovalLevel, validatedData.status === "APPROVED")
    
    const updatedDisbursement = await prisma.disbursementVoucher.update({
      where: { id },
      data: {
        status: newStatus,
        remarks: validatedData.status === "REJECTED" ? validatedData.remarks : undefined
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            role: true,
          }
        },
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          },
          orderBy: { level: "asc" }
        }
      }
    })

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: validatedData.status === "APPROVED" ? "APPROVE" : "REJECT",
        entityType: "DisbursementVoucher",
        entityId: id,
        newValues: {
          approval: approval,
          newStatus: newStatus,
          remarks: validatedData.remarks
        },
        userId: session.user.id,
        disbursementVoucherId: id
      }
    })

    // Send workflow notifications
    await sendWorkflowNotifications({
      disbursementId: id,
      payee: disbursement.payee,
      amount: Number(disbursement.amount),
      action: validatedData.status === "APPROVED" ? "APPROVE" : "REJECT",
      performedBy: session.user.name,
      performedByRole: session.user.role,
      disbursementCreatedBy: disbursement.createdBy.role,
      remarks: validatedData.remarks
    })

    return NextResponse.json({
      approval,
      disbursement: updatedDisbursement,
      message: `Disbursement ${validatedData.status.toLowerCase()} successfully`
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { error: "Validation error", details: (error as any).errors },
        { status: 400 }
      )
    }
    
    console.error("Error processing approval:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

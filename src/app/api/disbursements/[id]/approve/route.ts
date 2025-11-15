import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import { z } from "zod"
import { UserRole, VoucherStatus } from "@prisma/client"
import { sendWorkflowNotifications } from "@/lib/workflow-notifications"
import { getBacRequiredApprovals } from "@/lib/settings"

const approvalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  remarks: z.string().optional()
})

// Define approval levels and required roles
const APPROVAL_LEVELS = {
  1: ["SECRETARY"], // Secretary is now Level 1 for both workflows
  2: ["MAYOR"], // Mayor is now Level 2
  3: ["BUDGET"], // Budget for standard workflow, BAC for GSO workflow (handled separately)
  4: ["ACCOUNTING"], // Accounting for standard workflow, Budget for GSO workflow
  5: ["TREASURY"], // Treasury for standard workflow, Accounting for GSO workflow
  6: ["ADMIN"] // Admin for both workflows, Treasury for GSO workflow
}

function getApprovalLevel(role: UserRole, disbursementRole?: string): number | null {
  // Handle GSO workflow
  if (disbursementRole === "GSO") {
    switch (role) {
      case "SECRETARY": return 1 // Secretary is Level 1 for GSO workflow
      case "MAYOR": return 2 // Mayor is Level 2 for GSO workflow
      case "BUDGET": return 4 // Budget is Level 4 in GSO workflow (after BAC)
      case "ACCOUNTING": return 5 // Accounting is Level 5 in GSO workflow
      case "TREASURY": return 6 // Treasury is Level 6 in GSO workflow
      default: return null
    }
  }
  
  // Handle standard workflow (non-GSO)
  switch (role) {
    case "SECRETARY": return 1 // Secretary is Level 1 for standard workflow
    case "MAYOR": return 2 // Mayor is Level 2 for standard workflow
    case "BUDGET": return 3 // Budget is Level 3 for standard workflow
    case "ACCOUNTING": return 4 // Accounting is Level 4 for standard workflow
    case "TREASURY": return 5 // Treasury is Level 5 for standard workflow
    default: return null
  }
}

function getNextVoucherStatus(level: number, approved: boolean, disbursementRole?: string): VoucherStatus {
  if (!approved) return "REJECTED"
  
  // Handle GSO workflow
  if (disbursementRole === "GSO") {
    switch (level) {
      case 1: return "PENDING" // Secretary approval - moves to next level
      case 2: return "PENDING" // Mayor approval - moves to next level
      case 4: return "PENDING" // Budget approval - moves to next level
      case 5: return "PENDING" // Accounting approval - moves to next level
      case 6: return "RELEASED" // Treasury approval - final release
      default: return "PENDING"
    }
  }
  
  // Handle standard workflow (non-GSO)
  switch (level) {
    case 1: return "PENDING" // Secretary approval - moves to next level
    case 2: return "PENDING" // Mayor approval - moves to next level
    case 3: return "PENDING" // Budget approval - moves to next level
    case 4: return "PENDING" // Accounting approval - moves to next level
    case 5: return "RELEASED" // Treasury approval - final release
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
    const userApprovalLevel = getApprovalLevel(session.user.role, disbursement.createdBy.role)
    if (!userApprovalLevel) {
      return NextResponse.json({ error: "You don't have approval permissions" }, { status: 403 })
    }

    // Check if disbursement is in the right status for approval
    if (!["PENDING"].includes(disbursement.status)) {
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
      let previousLevelsCompleted = false
      
      // For GSO workflow, handle special cases
      if (disbursement.createdBy.role === "GSO") {
        if (userApprovalLevel === 4) {
          // Budget (Level 4) needs: Secretary (Level 1), Mayor (Level 2), and BAC (3+ reviews)
          const secretaryApproved = disbursement.approvals.some(approval => 
            approval.level === 1 && approval.status === "APPROVED"
          )
          const mayorApproved = disbursement.approvals.some(approval => 
            approval.level === 2 && approval.status === "APPROVED"
          )
          
          // Check BAC reviews
          const bacReviewCount = await prisma.bacReview.count({
            where: { disbursementVoucherId: id }
          })
          const requiredBacReviews = await getBacRequiredApprovals()
          const bacCompleted = bacReviewCount >= requiredBacReviews
          
          previousLevelsCompleted = secretaryApproved && mayorApproved && bacCompleted
        } else if (userApprovalLevel === 5) {
          // Accounting (Level 5) needs: Secretary (Level 1), Mayor (Level 2), BAC (3+ reviews), Budget (Level 4)
          const secretaryApproved = disbursement.approvals.some(approval => 
            approval.level === 1 && approval.status === "APPROVED"
          )
          const mayorApproved = disbursement.approvals.some(approval => 
            approval.level === 2 && approval.status === "APPROVED"
          )
          const budgetApproved = disbursement.approvals.some(approval => 
            approval.level === 4 && approval.status === "APPROVED"
          )
          
          const bacReviewCount = await prisma.bacReview.count({
            where: { disbursementVoucherId: id }
          })
          const requiredBacReviews = await getBacRequiredApprovals()
          const bacCompleted = bacReviewCount >= requiredBacReviews
          
          previousLevelsCompleted = secretaryApproved && mayorApproved && bacCompleted && budgetApproved
        } else if (userApprovalLevel === 6) {
          // Treasury (Level 6) needs: Secretary (Level 1), Mayor (Level 2), BAC (3+ reviews), Budget (Level 4), Accounting (Level 5)
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
          
          previousLevelsCompleted = secretaryApproved && mayorApproved && bacCompleted && budgetApproved && accountingApproved
        } else {
          // For other levels in GSO workflow, check approval records normally
          const previousLevels = Array.from({ length: userApprovalLevel - 1 }, (_, i) => i + 1)
          const previousApprovals = disbursement.approvals.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (approval: any) => previousLevels.includes(approval.level) && approval.status === "APPROVED"
          )
          previousLevelsCompleted = previousApprovals.length === previousLevels.length
        }
      } else {
        // For non-GSO workflow, check approval records normally
        const previousLevels = Array.from({ length: userApprovalLevel - 1 }, (_, i) => i + 1)
        const previousApprovals = disbursement.approvals.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (approval: any) => previousLevels.includes(approval.level) && approval.status === "APPROVED"
        )
        previousLevelsCompleted = previousApprovals.length === previousLevels.length
      }
      
      if (!previousLevelsCompleted) {
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
    const newStatus = getNextVoucherStatus(userApprovalLevel, validatedData.status === "APPROVED", disbursement.createdBy.role)
    
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
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        items: true,
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true
              }
            }
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
        },
        bacReviews: {
          include: {
            reviewer: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        auditTrails: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          },
          orderBy: {
            timestamp: "desc"
          }
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

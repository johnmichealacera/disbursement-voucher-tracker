import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { sendWorkflowNotifications } from "@/lib/workflow-notifications"

const secretaryReviewSchema = z.object({
  action: z.enum(["SECRETARY_REVIEWED"]),
  remarks: z.string().optional()
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    console.log(`Secretary review API called for disbursement: ${id}`)
    
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Secretary can review vouchers
    if (session.user.role !== "SECRETARY") {
      return NextResponse.json({ error: "Only Secretary can review vouchers" }, { status: 403 })
    }

    const body = await request.json()
    console.log(`Secretary review request body:`, body)
    
    const validatedData = secretaryReviewSchema.parse(body)

    // Get the disbursement
    const disbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, role: true, department: true } },
        items: true
      }
    })

    if (!disbursement) {
      return NextResponse.json({ error: "Disbursement not found" }, { status: 404 })
    }

    console.log(`Disbursement found: ${disbursement.payee}, Status: ${disbursement.status}, Created by: ${disbursement.createdBy.role}`)

    // Check if voucher is in a reviewable status
    const reviewableStatuses = ["PENDING"]
    if (!reviewableStatuses.includes(disbursement.status)) {
      console.log(`Cannot review voucher with status: ${disbursement.status}`)
      return NextResponse.json({ 
        error: `Cannot review voucher with status ${disbursement.status}` 
      }, { status: 400 })
    }

    // Check if Secretary has already reviewed this voucher (Level 1)
    const existingApproval = await prisma.approval.findFirst({
      where: {
        disbursementVoucherId: id,
        level: 1,
        status: "APPROVED"
      }
    })

    if (existingApproval) {
      return NextResponse.json({ error: "Secretary has already reviewed this voucher" }, { status: 400 })
    }

    // Create the approval record for Secretary (Level 1)
    const approval = await prisma.approval.create({
      data: {
        approverId: session.user.id,
        disbursementVoucherId: id,
        status: "APPROVED", // Secretary review is always an approval to proceed
        remarks: validatedData.remarks,
        level: 1, // Secretary is Level 1
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

    // Create audit trail for the review
    await prisma.auditTrail.create({
      data: {
        action: "SECRETARY_REVIEW",
        entityType: "DisbursementVoucher",
        entityId: disbursement.id,
        oldValues: { status: disbursement.status },
        newValues: { 
          status: disbursement.status, // Status doesn't change, just reviewed
          reviewedBy: session.user.name,
          reviewRemarks: validatedData.remarks 
        },
        userId: session.user.id,
        disbursementVoucherId: disbursement.id
      }
    })

    // Send workflow notifications (temporarily disabled for debugging)
    console.log(`Sending workflow notifications for GSO disbursement: ${disbursement.createdBy.role}`)
    try {
      await sendWorkflowNotifications({
        disbursementId: disbursement.id,
        payee: disbursement.payee,
        amount: Number(disbursement.amount),
        action: "SECRETARY_REVIEW",
        performedBy: session.user.name,
        performedByRole: "SECRETARY",
        disbursementCreatedBy: disbursement.createdBy.role,
        remarks: validatedData.remarks
      })
      console.log(`Workflow notifications sent successfully`)
    } catch (notificationError) {
      console.error(`Error sending notifications:`, notificationError)
      // Continue even if notifications fail
    }

    // Get updated disbursement with all relations
    console.log(`Fetching updated disbursement with all relations`)
    const updatedDisbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, department: true, role: true } },
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
          include: { approver: { select: { id: true, name: true, role: true } } }, 
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
          include: { user: { select: { name: true, role: true } } },
          orderBy: { timestamp: "desc" }
        }
      }
    })

    console.log(`Secretary review completed successfully for disbursement: ${id}`)
    return NextResponse.json(updatedDisbursement, { status: 200 })
  } catch (error) {
    console.error("Error Secretary reviewing disbursement:", error)
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ error: "Invalid request data", details: (error as any).errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

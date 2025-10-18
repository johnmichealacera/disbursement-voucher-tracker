import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendWorkflowNotifications } from "@/lib/workflow-notifications"

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

    // Get the disbursement
    const disbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
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
        items: true
      }
    })

    if (!disbursement) {
      return NextResponse.json({ error: "Disbursement not found" }, { status: 404 })
    }

    // Check if user can submit this disbursement
    if (disbursement.createdById !== session.user.id && !["ADMIN", "GSO", "HR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check if disbursement is in DRAFT status
    if (disbursement.status !== "DRAFT") {
      return NextResponse.json({ 
        error: `Cannot submit disbursement with status ${disbursement.status}. Only DRAFT disbursements can be submitted.` 
      }, { status: 400 })
    }

    // Validate that disbursement has required data based on user role
    if (disbursement.createdBy.role === "GSO") {
      // GSO users must have items
      if (!disbursement.items || disbursement.items.length === 0) {
        return NextResponse.json({ 
          error: "Cannot submit disbursement without items" 
        }, { status: 400 })
      }
    } else {
      // Non-GSO users must have a valid amount
      if (!disbursement.amount || disbursement.amount.toNumber() <= 0) {
        return NextResponse.json({ 
          error: "Cannot submit disbursement without a valid amount" 
        }, { status: 400 })
      }
    }

    // Update status to PENDING
    const updatedDisbursement = await prisma.disbursementVoucher.update({
      where: { id },
      data: {
        status: "PENDING"
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
        items: true,
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
        action: "SUBMIT",
        entityType: "DisbursementVoucher",
        entityId: disbursement.id,
        oldValues: { status: "DRAFT" },
        newValues: { status: "PENDING" },
        userId: session.user.id,
        disbursementVoucherId: disbursement.id
      }
    })

    // Send workflow notifications
    await sendWorkflowNotifications({
      disbursementId: disbursement.id,
      payee: disbursement.payee,
      amount: Number(disbursement.amount),
      action: "SUBMIT",
      performedBy: session.user.name,
      performedByRole: disbursement.createdBy.role,
      disbursementCreatedBy: disbursement.createdBy.role
    })

    return NextResponse.json(updatedDisbursement, { status: 200 })
  } catch (error) {
    console.error("Error submitting disbursement:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

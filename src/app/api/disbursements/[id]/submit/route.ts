import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
            department: true
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

    // Validate that disbursement has required data
    if (!disbursement.items || disbursement.items.length === 0) {
      return NextResponse.json({ 
        error: "Cannot submit disbursement without items" 
      }, { status: 400 })
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
            department: true
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

    return NextResponse.json(updatedDisbursement, { status: 200 })
  } catch (error) {
    console.error("Error submitting disbursement:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

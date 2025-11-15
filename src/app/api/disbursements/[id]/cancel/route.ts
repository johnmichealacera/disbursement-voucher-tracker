import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { sendWorkflowNotifications } from "@/lib/workflow-notifications"

const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional()
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

    let body: unknown = {}
    if (request.method !== "GET") {
      try {
        body = await request.json()
      } catch (error) {
        body = {}
      }
    }

    const validatedData = cancelSchema.safeParse(body)
    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          details: (validatedData.error as any)?.errors as any
        },
        { status: 400 }
      )
    }

    const disbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            department: true
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
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
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
        },
        items: true
      }
    })

    if (!disbursement) {
      return NextResponse.json({ error: "Disbursement not found" }, { status: 404 })
    }

    // Only system administrators can cancel disbursements
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only system administrators can cancel disbursements" }, { status: 403 })
    }

    if (["RELEASED", "REJECTED", "CANCELLED"].includes(disbursement.status)) {
      return NextResponse.json(
        { error: `Cannot cancel a disbursement that is already ${disbursement.status.toLowerCase()}` },
        { status: 400 }
      )
    }

    const updatedDisbursement = await prisma.disbursementVoucher.update({
      where: { id },
      data: {
        status: "CANCELLED"
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            department: true
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
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
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
        },
        items: true
      }
    })

    await prisma.auditTrail.create({
      data: {
        action: "CANCELLED",
        entityType: "DisbursementVoucher",
        entityId: id,
        oldValues: {
          status: disbursement.status
        },
        newValues: {
          status: "CANCELLED",
          cancellationReason: validatedData.data.reason ?? null
        },
        userId: session.user.id,
        disbursementVoucherId: id
      }
    })

    await sendWorkflowNotifications({
      disbursementId: updatedDisbursement.id,
      payee: updatedDisbursement.payee,
      amount: Number(updatedDisbursement.amount),
      action: "CANCELLED",
      performedBy: session.user.name ?? "Unknown User",
      performedByRole: session.user.role,
      disbursementCreatedBy: updatedDisbursement.createdBy.role,
      remarks: validatedData.data.reason
    })

    return NextResponse.json(updatedDisbursement)
  } catch (error) {
    console.error("Error cancelling disbursement:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


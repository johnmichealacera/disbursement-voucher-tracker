import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateDisbursementSchema = z.object({
  title: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  purpose: z.string().min(1).optional(),
  project: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING", "VALIDATED", "APPROVED", "RELEASED", "REJECTED"]).optional(),
  remarks: z.string().optional(),
  assignedToId: z.string().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    totalPrice: z.number().positive()
  })).optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const disbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            role: true
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
          orderBy: {
            level: "asc"
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

    if (!disbursement) {
      return NextResponse.json({ error: "Disbursement not found" }, { status: 404 })
    }

    // Check access permissions
    const canAccess = 
      disbursement.createdById === session.user.id ||
      disbursement.assignedToId === session.user.id ||
      ["ADMIN", "ACCOUNTING", "BUDGET", "TREASURY", "MAYOR", "DEPARTMENT_HEAD", "FINANCE_HEAD", "BAC"].includes(session.user.role)

    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    return NextResponse.json(disbursement)
  } catch (error) {
    console.error("Error fetching disbursement:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const validatedData = updateDisbursementSchema.parse(body)

    // Get current disbursement
    const currentDisbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
      include: { items: true }
    })

    if (!currentDisbursement) {
      return NextResponse.json({ error: "Disbursement not found" }, { status: 404 })
    }

    // Check permissions
    const canEdit = 
      currentDisbursement.createdById === session.user.id ||
      ["ADMIN", "ACCOUNTING", "BUDGET", "TREASURY", "MAYOR", "DEPARTMENT_HEAD", "FINANCE_HEAD"].includes(session.user.role)

    if (!canEdit) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Prepare update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}
    
    if (validatedData.title !== undefined) updateData.title = validatedData.title
    if (validatedData.amount !== undefined) updateData.amount = validatedData.amount
    if (validatedData.purpose !== undefined) updateData.purpose = validatedData.purpose
    if (validatedData.project !== undefined) updateData.project = validatedData.project
    if (validatedData.status !== undefined) updateData.status = validatedData.status
    if (validatedData.remarks !== undefined) updateData.remarks = validatedData.remarks
    if (validatedData.assignedToId !== undefined) updateData.assignedToId = validatedData.assignedToId

    // Handle items update if provided
    if (validatedData.items) {
      // Delete existing items and create new ones
      await prisma.disbursementItem.deleteMany({
        where: { disbursementVoucherId: id }
      })
      
      updateData.items = {
        create: validatedData.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        }))
      }
    }

    const updatedDisbursement = await prisma.disbursementVoucher.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: true,
        attachments: true,
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
        }
      }
    })

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: "UPDATE",
        entityType: "DisbursementVoucher",
        entityId: id,
        oldValues: currentDisbursement,
        newValues: updatedDisbursement,
        userId: session.user.id,
        disbursementVoucherId: id
      }
    })

    return NextResponse.json(updatedDisbursement)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { error: "Validation error", details: (error as any).errors },
        { status: 400 }
      )
    }
    
    console.error("Error updating disbursement:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const disbursement = await prisma.disbursementVoucher.findUnique({
      where: { id }
    })

    if (!disbursement) {
      return NextResponse.json({ error: "Disbursement not found" }, { status: 404 })
    }

    // Only allow deletion of draft disbursements by creator or admin
    const canDelete = 
      (disbursement.createdById === session.user.id && disbursement.status === "DRAFT") ||
      session.user.role === "ADMIN"

    if (!canDelete) {
      return NextResponse.json({ error: "Cannot delete this disbursement" }, { status: 403 })
    }

    await prisma.disbursementVoucher.delete({
      where: { id }
    })

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: "DELETE",
        entityType: "DisbursementVoucher",
        entityId: id,
        oldValues: disbursement,
        userId: session.user.id
      }
    })

    return NextResponse.json({ message: "Disbursement deleted successfully" })
  } catch (error) {
    console.error("Error deleting disbursement:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { VoucherStatus } from "@prisma/client"
import { notifySourceOffices } from "@/lib/notifications"
import { sendWorkflowNotifications } from "@/lib/workflow-notifications"

const createDisbursementSchema = z.object({
  payee: z.string().min(1, "Payee is required"),
  address: z.string().min(1, "Address is required"),
  amount: z.number().positive("Amount must be positive"),
  particulars: z.string().min(1, "Particulars is required"),
  tags: z.array(z.string()).default([]),
  sourceOffice: z.array(z.string()).default([]),
  remarks: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING"]).optional().default("DRAFT"),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.number().positive("Quantity must be positive"),
    unit: z.string().min(1, "Unit is required"),
    unitPrice: z.number().positive("Unit price must be positive"),
    totalPrice: z.number().positive("Total price must be positive")
  })).optional().default([])
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") as VoucherStatus | null
    const department = searchParams.get("department")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    
    // Filter by status if provided
    if (status) {
      where.status = status
    }

    // Filter by department if provided
    if (department) {
      where.createdBy = {
        department: department
      }
    }

    // Role-based filtering
    if (["REQUESTER", "GSO", "HR"].includes(session.user.role)) {
      where.createdById = session.user.id
    } else if (session.user.role === "ACCOUNTING") {
      // Accounting can view all vouchers (existing functionality) + GSO vouchers for review workflow
      where.OR = [
        {
          status: {
            in: ["PENDING", "VALIDATED", "APPROVED", "RELEASED"]
          }
        },
        {
          createdBy: {
            role: "GSO"
          }
        }
      ]
    } else if (session.user.role === "MAYOR") {
      // Mayor can view all vouchers from GSO, HR, and regular offices
      where.AND = [
        {
          createdBy: {
            role: {
              in: ["GSO", "HR", "REQUESTER"]
            }
          }
        },
        {
          status: {
            in: ["PENDING", "VALIDATED", "APPROVED", "RELEASED", "REJECTED"]
          }
        }
      ]
    } else if (session.user.role === "BAC") {
      // BAC can view all GSO vouchers (review button will be controlled in UI)
      where.createdBy = {
        role: "GSO"
      }
    } else if (session.user.role === "BUDGET") {
      // Budget Office can view all vouchers that need their review
      where.status = {
        in: ["PENDING", "VALIDATED", "APPROVED", "RELEASED", "REJECTED"]
      }
    } else if (session.user.role === "TREASURY") {
      // Treasury can view all vouchers that need their review
      where.status = {
        in: ["PENDING", "VALIDATED", "APPROVED", "RELEASED", "REJECTED"]
      }
    }

    const [disbursements, total] = await Promise.all([
      prisma.disbursementVoucher.findMany({
        where,
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
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take: limit
      }),
      prisma.disbursementVoucher.count({ where })
    ])

    return NextResponse.json({
      disbursements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching disbursements:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createDisbursementSchema.parse(body)

    const disbursement = await prisma.disbursementVoucher.create({
      data: {
        payee: validatedData.payee,
        address: validatedData.address,
        amount: validatedData.amount,
        particulars: validatedData.particulars,
        tags: validatedData.tags,
        sourceOffice: validatedData.sourceOffice,
        remarks: validatedData.remarks,
        createdById: session.user.id,
        status: validatedData.status || "DRAFT",
        items: validatedData.items && validatedData.items.length > 0 ? {
          create: validatedData.items
        } : undefined
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
        items: true
      }
    })

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: validatedData.status === "PENDING" ? "SUBMIT" : "CREATE",
        entityType: "DisbursementVoucher",
        entityId: disbursement.id,
        newValues: disbursement,
        userId: session.user.id,
        disbursementVoucherId: disbursement.id
      }
    })

    // Send notifications to source offices if any are specified
    if (validatedData.sourceOffice && validatedData.sourceOffice.length > 0) {
      await notifySourceOffices(validatedData.sourceOffice, {
        id: disbursement.id,
        payee: disbursement.payee,
        amount: Number(disbursement.amount),
        createdBy: disbursement.createdBy
      })
    }

    // Send workflow notifications for voucher creation
    await sendWorkflowNotifications({
      disbursementId: disbursement.id,
      payee: disbursement.payee,
      amount: Number(disbursement.amount),
      action: validatedData.status === "PENDING" ? "SUBMIT" : "CREATE",
      performedBy: session.user.name,
      performedByRole: disbursement.createdBy.role,
      disbursementCreatedBy: disbursement.createdBy.role
    })

    return NextResponse.json(disbursement, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { error: "Validation error", details: (error as any).errors },
        { status: 400 }
      )
    }
    
    console.error("Error creating disbursement:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

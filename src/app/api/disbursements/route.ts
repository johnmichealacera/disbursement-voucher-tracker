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
    const searchTerm = searchParams.get("search")
    const minAmount = searchParams.get("minAmount")
    const maxAmount = searchParams.get("maxAmount")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    
    // Filter by status if provided
    if (status) {
      where.status = status
    }

    // Filter by search term (payee, particulars, or requester)
    if (searchTerm) {
      where.OR = [
        {
          payee: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          particulars: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          createdBy: {
            name: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          }
        }
      ]
    }

    // Filter by amount range if provided
    if (minAmount || maxAmount) {
      where.amount = {}
      if (minAmount) {
        where.amount.gte = parseFloat(minAmount)
      }
      if (maxAmount) {
        where.amount.lte = parseFloat(maxAmount)
      }
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
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
    } else if (session.user.role === "SECRETARY") {
      // Secretary can view all vouchers that need their review
      where.status = {
        in: ["PENDING", "VALIDATED", "APPROVED", "RELEASED", "REJECTED"]
      }
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
        select: {
          id: true,
          payee: true,
          particulars: true,
          amount: true,
          status: true,
          createdAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              department: true,
              role: true
            }
          },
          approvals: {
            select: {
              level: true,
              status: true,
              approver: {
                select: {
                  name: true,
                  role: true
                }
              }
            }
          },
          bacReviews: {
            select: {
              reviewer: {
                select: {
                  name: true,
                  role: true
                }
              }
            }
          },
          auditTrails: {
            select: {
              action: true,
              user: {
                select: {
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

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { VoucherStatus } from "@prisma/client"

const createDisbursementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z.number().positive("Amount must be positive"),
  purpose: z.string().min(1, "Purpose is required"),
  project: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING"]).optional().default("DRAFT"),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.number().positive("Quantity must be positive"),
    unitPrice: z.number().positive("Unit price must be positive"),
    totalPrice: z.number().positive("Total price must be positive")
  }))
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
    if (session.user.role === "REQUESTER") {
      where.createdById = session.user.id
    } else if (session.user.role === "ACCOUNTING") {
      where.status = {
        in: ["PENDING", "VALIDATED", "APPROVED", "RELEASED"]
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
        title: validatedData.title,
        amount: validatedData.amount,
        purpose: validatedData.purpose,
        project: validatedData.project,
        createdById: session.user.id,
        status: validatedData.status || "DRAFT",
        items: {
          create: validatedData.items
        }
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

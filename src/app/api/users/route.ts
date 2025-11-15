import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/utils"
import { z } from "zod"
import { UserRole } from "@prisma/client"

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["REQUESTER", "ACCOUNTING", "BUDGET", "TREASURY", "MAYOR", "ADMIN", "DEPARTMENT_HEAD", "FINANCE_HEAD", "GSO", "HR", "BAC", "SECRETARY"]),
  department: z.string().optional()
}).refine((data) => {
  // Department is required for REQUESTER role
  if (data.role === "REQUESTER") {
    return data.department && data.department.trim().length > 0
  }
  return true
}, {
  message: "Department is required for Requester role",
  path: ["department"]
})

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["REQUESTER", "ACCOUNTING", "BUDGET", "TREASURY", "MAYOR", "ADMIN", "DEPARTMENT_HEAD", "FINANCE_HEAD", "GSO", "HR", "BAC", "SECRETARY"]).optional(),
  department: z.string().optional(),
  isActive: z.boolean().optional()
}).refine((data) => {
  // Department is required for REQUESTER role
  if (data.role === "REQUESTER") {
    return data.department && data.department.trim().length > 0
  }
  return true
}, {
  message: "Department is required for Requester role",
  path: ["department"]
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role") as UserRole | null
    const department = searchParams.get("department")
    const isActive = searchParams.get("isActive")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    
    if (role) where.role = role
    if (department) where.department = department
    if (isActive !== null) where.isActive = isActive === "true"

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              createdVouchers: true,
              approvals: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password)

    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
        department: validatedData.department
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true
      }
    })

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: "CREATE",
        entityType: "User",
        entityId: user.id,
        newValues: user,
        userId: session.user.id
      }
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { error: "Validation error", details: (error as any).errors },
        { status: 400 }
      )
    }
    
    console.error("Error creating user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

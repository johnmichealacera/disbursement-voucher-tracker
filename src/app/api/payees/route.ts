import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const payeeQuerySchema = z.object({
  status: z
    .enum(["ACTIVE", "INACTIVE"])
    .optional()
    .default("ACTIVE"),
  search: z.string().optional()
})

const createPayeeSchema = z.object({
  name: z.string().min(1, "Payee name is required").max(255),
  address: z.string().min(1, "Address is required").max(500),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE")
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryResult = payeeQuerySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined
    })

    if (!queryResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: queryResult.error.flatten() },
        { status: 400 }
      )
    }

    const { status, search } = queryResult.data

    const payees = await prisma.payeeDirectory.findMany({
      where: {
        status,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { address: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: {
        name: "asc"
      }
    })

    return NextResponse.json({ payees })
  } catch (error) {
    console.error("Error fetching payees:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsedBody = createPayeeSchema.safeParse(await request.json())

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsedBody.error.flatten() },
        { status: 400 }
      )
    }

    const { name, address, status } = parsedBody.data

    const existing = await prisma.payeeDirectory.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive"
        },
        address: {
          equals: address,
          mode: "insensitive"
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        {
          error: "Duplicate payee",
          details: "A payee with the same name and address already exists."
        },
        { status: 409 }
      )
    }

    const payee = await prisma.payeeDirectory.create({
      data: {
        name,
        address,
        status
      }
    })

    return NextResponse.json({ payee }, { status: 201 })
  } catch (error) {
    console.error("Error creating payee:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


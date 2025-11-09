import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const itemQuerySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
  search: z.string().optional()
})

const createItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(255),
  unit: z.string().max(50).optional().or(z.literal("")),
  defaultUnitPrice: z.number().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE")
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsedQuery = itemQuerySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined
    })

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsedQuery.error.flatten() },
        { status: 400 }
      )
    }

    const { status, search } = parsedQuery.data

    const items = await prisma.itemDirectory.findMany({
      where: {
        status,
        ...(search
          ? {
              name: {
                contains: search,
                mode: "insensitive"
              }
            }
          : {})
      },
      orderBy: {
        name: "asc"
      }
    })

    const serialized = items.map(item => ({
      ...item,
      defaultUnitPrice: item.defaultUnitPrice
        ? Number(item.defaultUnitPrice)
        : null
    }))

    return NextResponse.json({ items: serialized })
  } catch (error) {
    console.error("Error fetching items:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsedBody = createItemSchema.safeParse(await request.json())

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsedBody.error.flatten() },
        { status: 400 }
      )
    }

    const { name, unit, defaultUnitPrice, status } = parsedBody.data

    const existing = await prisma.itemDirectory.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive"
        },
        unit: unit && unit.length > 0 ? { equals: unit, mode: "insensitive" } : null
      }
    })

    if (existing) {
      return NextResponse.json(
        {
          error: "Duplicate item",
          details: "An item with the same name and unit already exists."
        },
        { status: 409 }
      )
    }

    const item = await prisma.itemDirectory.create({
      data: {
        name,
        unit: unit && unit.length > 0 ? unit : null,
        defaultUnitPrice: defaultUnitPrice ?? null,
        status
      }
    })

    return NextResponse.json(
      {
        item: {
          ...item,
          defaultUnitPrice: item.defaultUnitPrice
            ? Number(item.defaultUnitPrice)
            : null
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating item:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


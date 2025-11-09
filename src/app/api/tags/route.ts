import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const tagQuerySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
  search: z.string().optional()
})

const createTagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(100),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE")
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsedQuery = tagQuerySchema.safeParse({
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

    const tags = await prisma.tagDirectory.findMany({
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

    return NextResponse.json({ tags })
  } catch (error) {
    console.error("Error fetching tags:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsedBody = createTagSchema.safeParse(await request.json())

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsedBody.error.flatten() },
        { status: 400 }
      )
    }

    const { name, status } = parsedBody.data

    const existing = await prisma.tagDirectory.findUnique({
      where: {
        name: name
      }
    })

    if (existing) {
      return NextResponse.json(
        {
          error: "Duplicate tag",
          details: "A tag with the same name already exists."
        },
        { status: 409 }
      )
    }

    const tag = await prisma.tagDirectory.create({
      data: {
        name,
        status
      }
    })

    return NextResponse.json({ tag }, { status: 201 })
  } catch (error) {
    console.error("Error creating tag:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


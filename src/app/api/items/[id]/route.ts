import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const updateItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  unit: z.string().max(50).optional().or(z.literal("")),
  defaultUnitPrice: z.number().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const parsedBody = updateItemSchema.safeParse(await request.json())
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsedBody.error.flatten() },
        { status: 400 }
      )
    }

    if (Object.keys(parsedBody.data).length === 0) {
      return NextResponse.json(
        { error: "No fields provided to update" },
        { status: 400 }
      )
    }

    const { unit, ...rest } = parsedBody.data

    const updated = await prisma.itemDirectory.update({
      where: {
        id
      },
      data: {
        ...rest,
        unit: unit !== undefined ? (unit.length > 0 ? unit : null) : undefined
      }
    })

    return NextResponse.json({
      item: {
        ...updated,
        defaultUnitPrice: updated.defaultUnitPrice
          ? Number(updated.defaultUnitPrice)
          : null
      }
    })
  } catch (error) {
    console.error("Error updating item:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


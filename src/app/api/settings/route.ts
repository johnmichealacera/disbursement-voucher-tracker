import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSettingsSchema = z.object({
  key: z.string(),
  value: z.string(),
  description: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN can view settings
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const settings = await prisma.systemSettings.findMany({
      orderBy: { key: "asc" }
    })

    return NextResponse.json(settings, { status: 200 })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN can update settings
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateSettingsSchema.parse(body)

    // Upsert the setting
    const setting = await prisma.systemSettings.upsert({
      where: { key: validatedData.key },
      update: {
        value: validatedData.value,
        description: validatedData.description,
        updatedAt: new Date()
      },
      create: {
        id: validatedData.key,
        key: validatedData.key,
        value: validatedData.value,
        description: validatedData.description
      }
    })

    return NextResponse.json(setting, { status: 200 })
  } catch (error) {
    console.error("Error updating settings:", error)
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ error: "Invalid request data", details: (error as any).errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


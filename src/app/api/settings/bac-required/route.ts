import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Public endpoint to get BAC required approvals setting
 * All authenticated users can access this
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const setting = await prisma.systemSettings.findUnique({
      where: { key: "bac_required_approvals" }
    })

    // Return the value or default to 3
    const value = setting ? parseInt(setting.value, 10) : 3
    return NextResponse.json({ value: isNaN(value) ? 3 : value }, { status: 200 })
  } catch (error) {
    console.error("Error fetching BAC required approvals:", error)
    // Return default value on error
    return NextResponse.json({ value: 3 }, { status: 200 })
  }
}


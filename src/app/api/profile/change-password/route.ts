import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: "Current password and new password are required" },
        { status: 400 }
      )
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return NextResponse.json(
        { message: "New password must be at least 6 characters long" },
        { status: 400 }
      )
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      )
    }

    // Verify current password
    if (user.password) {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { message: "Current password is incorrect" },
          { status: 400 }
        )
      }
    } else {
      // Handle OAuth users who don't have passwords
      return NextResponse.json(
        { message: "Password change not available for OAuth accounts" },
        { status: 400 }
      )
    }

    // Hash new password
    const saltRounds = 12
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

    // Update password
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedNewPassword }
    })

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: "PASSWORD_CHANGE",
        entityType: "User",
        entityId: session.user.id,
        userId: session.user.id,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
        newValues: { passwordChanged: true }
      }
    })

    return NextResponse.json(
      { message: "Password changed successfully" },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error changing password:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

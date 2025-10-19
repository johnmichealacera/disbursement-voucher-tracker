import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const { name } = await request.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { message: "Name is required" },
        { status: 400 }
      )
    }

    if (name.trim().length < 2) {
      return NextResponse.json(
        { message: "Name must be at least 2 characters long" },
        { status: 400 }
      )
    }

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {
      name: name.trim()
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData
    })

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        action: "UPDATE",
        entityType: "User",
        entityId: session.user.id,
        userId: session.user.id,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
        oldValues: {
          name: currentUser.name
        },
        newValues: {
          name: updatedUser.name
        }
      }
    })

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        department: updatedUser.department,
        role: updatedUser.role
      }
    })

  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Get user's activity log
    const activities = await prisma.auditTrail.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        timestamp: "desc"
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        oldValues: true,
        newValues: true,
        ipAddress: true,
        userAgent: true,
        timestamp: true
      }
    })

    // Format activities for display
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      description: generateActivityDescription(activity),
      timestamp: activity.timestamp.toISOString(),
      ipAddress: activity.ipAddress,
      userAgent: activity.userAgent,
      oldValues: activity.oldValues,
      newValues: activity.newValues
    }))

    return NextResponse.json({
      activities: formattedActivities,
      total: formattedActivities.length
    })

  } catch (error) {
    console.error("Error fetching activity log:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

function generateActivityDescription(activity: any): string {
  const { action, entityType, oldValues, newValues } = activity
  
  switch (action) {
    case "CREATE":
      return `Created new ${entityType.toLowerCase().replace("voucher", "voucher")}`
    
    case "UPDATE":
      if (entityType === "User" && newValues?.passwordChanged) {
        return "Changed account password"
      }
      return `Updated ${entityType.toLowerCase().replace("voucher", "voucher")} information`
    
    case "DELETE":
      return `Deleted ${entityType.toLowerCase().replace("voucher", "voucher")}`
    
    case "APPROVE":
      return `Approved ${entityType.toLowerCase().replace("voucher", "voucher")}`
    
    case "REJECT":
      return `Rejected ${entityType.toLowerCase().replace("voucher", "voucher")}`
    
    case "PASSWORD_CHANGE":
      return "Changed account password"
    
    default:
      return `${action} ${entityType.toLowerCase().replace("voucher", "voucher")}`
  }
}

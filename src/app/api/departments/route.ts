import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get unique roles from users and map them to office names
    const users = await prisma.user.findMany({
      select: {
        role: true
      },
      distinct: ['role']
    })

    // Map roles to office names
    const roleToOfficeMap: Record<string, string> = {
      'GSO': 'General Services Office',
      'BAC': 'Bids and Awards Committee',
      'MAYOR': 'Mayor\'s Office',
      'TREASURY': 'Treasury Office',
      'BUDGET': 'Budget Office',
      'ACCOUNTING': 'Accounting Office',
      'HR': 'Human Resources Office',
      'FINANCE_HEAD': 'Finance Office',
      'DEPARTMENT_HEAD': 'Department Head Office',
      'ADMIN': 'Administrative Office',
      'REQUESTER': 'Requesting Office'
    }

    const offices = users
      .map(user => roleToOfficeMap[user.role] || user.role)
      .filter(Boolean)
      .sort()

    return NextResponse.json(offices)
  } catch (error) {
    console.error("Error fetching offices:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

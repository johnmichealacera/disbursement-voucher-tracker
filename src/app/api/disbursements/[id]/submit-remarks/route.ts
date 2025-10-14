import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { createNotification } from "@/lib/notifications"

const submitRemarksSchema = z.object({
  remarks: z.string().min(1, "Remarks are required"),
  targetOffices: z.array(z.string()).min(1, "At least one target office is required")
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = submitRemarksSchema.parse(body)

    // Get the disbursement
    const disbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, department: true } },
        items: true
      }
    })

    if (!disbursement) {
      return NextResponse.json({ error: "Disbursement not found" }, { status: 404 })
    }

    // Check if user can submit remarks (anyone with access to the voucher can submit remarks)
    const canSubmitRemarks = 
      disbursement.createdById === session.user.id ||
      ["ADMIN", "ACCOUNTING", "BUDGET", "TREASURY", "MAYOR", "DEPARTMENT_HEAD", "FINANCE_HEAD", "BAC"].includes(session.user.role)

    if (!canSubmitRemarks) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Map office names to roles to find users
    const officeToRoleMap: Record<string, string> = {
      'General Services Office': 'GSO',
      'Bids and Awards Committee': 'BAC',
      'Mayor\'s Office': 'MAYOR',
      'Treasury Office': 'TREASURY',
      'Budget Office': 'BUDGET',
      'Accounting Office': 'ACCOUNTING',
      'Human Resources Office': 'HR',
      'Finance Office': 'FINANCE_HEAD',
      'Department Head Office': 'DEPARTMENT_HEAD',
      'Administrative Office': 'ADMIN',
      'Requesting Office': 'REQUESTER'
    }

    // Create audit trail for the remarks submission
    await prisma.auditTrail.create({
      data: {
        action: "SUBMIT_REMARKS",
        entityType: "DisbursementVoucher",
        entityId: disbursement.id,
        oldValues: { 
          action: "Remarks submitted",
          targetOffices: validatedData.targetOffices
        },
        newValues: { 
          remarks: validatedData.remarks,
          submittedBy: session.user.name,
          submittedByRole: session.user.role,
          targetOffices: validatedData.targetOffices
        },
        userId: session.user.id,
        disbursementVoucherId: disbursement.id
      }
    })

    // Send notifications to target offices
    for (const office of validatedData.targetOffices) {
      const role = officeToRoleMap[office]
      if (!role) continue

      // Find users with this role
      const users = await prisma.user.findMany({
        where: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          role: role as any,
          isActive: true
        }
      })

      // Create notifications for each user in this office
      for (const user of users) {
        await createNotification({
          type: "remarks_submitted",
          title: "New Remarks Submitted",
          message: `${session.user.name} (${session.user.role}) has submitted remarks for disbursement voucher "${disbursement.payee}" (₱${disbursement.amount.toLocaleString()}). Remarks: "${validatedData.remarks}"`,
          userId: user.id,
          disbursementVoucherId: disbursement.id,
          priority: "high"
        })
      }
    }

    // Get updated disbursement with all relations
    const updatedDisbursement = await prisma.disbursementVoucher.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, department: true, role: true } },
        items: true,
        approvals: { 
          include: { approver: { select: { id: true, name: true, role: true } } }, 
          orderBy: { level: "asc" } 
        },
        auditTrails: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { timestamp: "desc" }
        }
      }
    })

    return NextResponse.json({
      message: "Remarks submitted successfully",
      disbursement: updatedDisbursement
    }, { status: 200 })

  } catch (error) {
    console.error("Error submitting remarks:", error)
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ error: "Invalid request data", details: (error as any).errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

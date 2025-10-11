"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate, formatDateTime, getStatusColor } from "@/lib/utils"
import { 
  ArrowLeft, 
  Send, 
  Edit, 
  FileText, 
  User, 
  Calendar, 
  DollarSign,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye
} from "lucide-react"

interface DisbursementItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface User {
  id: string
  name: string
  email: string
  department?: string
  role: string
}

interface Approval {
  id: string
  status: string
  remarks?: string
  level: number
  approvedAt?: string
  approver: User
}

interface AuditTrail {
  id: string
  userId: string
  action: string
  timestamp: string
  user: User
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldValues?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  newValues?: any
}

interface Disbursement {
  id: string
  title: string
  amount: number
  purpose: string
  project?: string
  status: string
  remarks?: string
  createdAt: string
  updatedAt: string
  createdBy: User
  assignedTo?: User
  items: DisbursementItem[]
  approvals: Approval[]
  auditTrails: AuditTrail[]
}

export default function DisbursementDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [disbursement, setDisbursement] = useState<Disbursement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

  const fetchDisbursement = async () => {
    try {
      const response = await fetch(`/api/disbursements/${id}`)
      if (response.ok) {
        const data = await response.json()
        setDisbursement(data)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to fetch disbursement")
      }
    } catch (error) {
      setError("An error occurred while fetching the disbursement")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitForReview = async () => {
    if (!disbursement) return

    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch(`/api/disbursements/${id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to submit for review")
      }
    } catch (error) {
      setError("An error occurred while submitting for review")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApproval = async (status: "APPROVED" | "REJECTED", remarks?: string) => {
    if (!disbursement) return

    setIsApproving(true)
    setError("")

    try {
      const response = await fetch(`/api/disbursements/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          remarks
        }),
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
      } else {
        const errorData = await response.json()
        setError(errorData.error || `Failed to ${status.toLowerCase()} disbursement`)
      }
    } catch (error) {
      setError(`An error occurred while ${status.toLowerCase()}ing the disbursement`)
    } finally {
      setIsApproving(false)
    }
  }

  const handleReview = async () => {
    if (!disbursement) return

    setIsApproving(true)
    setError("")

    try {
      const response = await fetch(`/api/disbursements/${id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "REVIEWED"
        }),
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to review voucher")
      }
    } catch (error) {
      console.error("Error reviewing disbursement:", error)
      setError("Failed to review voucher")
    } finally {
      setIsApproving(false)
    }
  }

  const handleBacReview = async () => {
    if (!disbursement) return

    setIsApproving(true)
    setError("")

    try {
      const response = await fetch(`/api/disbursements/${id}/bac-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "BAC_REVIEWED"
        }),
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to BAC review voucher")
      }
    } catch (error) {
      console.error("Error BAC reviewing disbursement:", error)
      setError("Failed to BAC review voucher")
    } finally {
      setIsApproving(false)
    }
  }

  const handleBudgetReview = async () => {
    if (!disbursement) return

    setIsApproving(true)
    setError("")

    try {
      const response = await fetch(`/api/disbursements/${id}/budget-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "BUDGET_REVIEWED"
        }),
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to Budget review voucher")
      }
    } catch (error) {
      console.error("Error Budget reviewing disbursement:", error)
      setError("Failed to Budget review voucher")
    } finally {
      setIsApproving(false)
    }
  }

  const handleAccountingReview = async () => {
    if (!disbursement) return

    setIsApproving(true)
    setError("")

    try {
      const response = await fetch(`/api/disbursements/${id}/accounting-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "ACCOUNTING_REVIEWED"
        }),
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to Accounting review voucher")
      }
    } catch (error) {
      console.error("Error Accounting reviewing disbursement:", error)
      setError("Failed to Accounting review voucher")
    } finally {
      setIsApproving(false)
    }
  }

  const handleTreasuryReview = async () => {
    if (!disbursement) return

    setIsApproving(true)
    setError("")

    try {
      const response = await fetch(`/api/disbursements/${id}/treasury-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "TREASURY_REVIEWED"
        }),
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to Treasury review voucher")
      }
    } catch (error) {
      console.error("Error Treasury reviewing disbursement:", error)
      setError("Failed to Treasury review voucher")
    } finally {
      setIsApproving(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchDisbursement()
    }
  }, [id])

  if (!session) {
    return null
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (error || !disbursement) {
    return (
      <MainLayout>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || "Disbursement not found"}
            </AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            onClick={() => router.push("/disbursements")}
            className="mt-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Disbursements
          </Button>
        </div>
      </MainLayout>
    )
  }

  const canSubmit = disbursement.status === "DRAFT" && 
    (disbursement.createdBy.id === session.user.id || ["ADMIN", "GSO", "HR"].includes(session.user.role))

  const canEdit = disbursement.status === "DRAFT" && 
    (disbursement.createdBy.id === session.user.id || ["ADMIN", "GSO", "HR"].includes(session.user.role))

  // Determine approval permissions based on role and current status
  const getApprovalLevel = (role: string): number | null => {
    switch (role) {
      case "DEPARTMENT_HEAD": return 1
      case "FINANCE_HEAD":
      case "ACCOUNTING": return 2
      case "MAYOR": return 3
      default: return null
    }
  }

  const userApprovalLevel = getApprovalLevel(session.user.role)
  const isAdmin = session.user.role === "ADMIN"
  
  // For admin, determine what level they can approve based on current status and existing approvals
  const getAdminApprovalLevel = (): number | null => {
    if (!isAdmin) return null
    
    // Find the next level that needs approval
    for (let level = 1; level <= 3; level++) {
      const hasApprovalAtLevel = disbursement.approvals.some(approval => 
        approval.level === level && approval.status === "APPROVED"
      )
      if (!hasApprovalAtLevel) {
        return level
      }
    }
    return null
  }

  const effectiveApprovalLevel = isAdmin ? getAdminApprovalLevel() : userApprovalLevel
  
  // Check if user can approve at their level
  const canApprove = effectiveApprovalLevel && 
    ["PENDING", "VALIDATED"].includes(disbursement.status) &&
    !disbursement.approvals.some(approval => 
      approval.approver.id === session.user.id && approval.level === effectiveApprovalLevel
    )

  // Check if previous levels are completed (for levels > 1)
  const previousLevelsCompleted = effectiveApprovalLevel === 1 || 
    (effectiveApprovalLevel && effectiveApprovalLevel > 1 && 
     Array.from({ length: effectiveApprovalLevel - 1 }, (_, i) => i + 1)
       .every(level => 
         disbursement.approvals.some(approval => 
           approval.level === level && approval.status === "APPROVED"
         )
       )
    )

  const canApproveNow = canApprove && previousLevelsCompleted

  // Mayor review logic
  const canMayorReview = session.user.role === "MAYOR" && 
    disbursement && 
    ["GSO", "HR", "REQUESTER"].includes(disbursement.createdBy.role) &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status)

  // Check if Mayor has already reviewed this voucher
  const mayorHasReviewed = disbursement && session.user.role === "MAYOR" &&
    disbursement.auditTrails.some(trail => 
      trail.action === "REVIEW" && 
      trail.userId === session.user.id
    )

  // Check if Mayor has reviewed this GSO voucher
  const mayorHasReviewedGso = disbursement && 
    disbursement.createdBy.role === "GSO" &&
    disbursement.auditTrails.some(trail => 
      trail.action === "REVIEW" && 
      trail.user.role === "MAYOR"
    )

  // BAC review logic - only for GSO vouchers after Mayor review
  const canBacReview = session.user.role === "BAC" && 
    disbursement && 
    disbursement.createdBy.role === "GSO" &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status) &&
    mayorHasReviewedGso

  // Show BAC review button for GSO vouchers (but may be disabled)
  const showBacReviewButton = session.user.role === "BAC" && 
    disbursement && 
    disbursement.createdBy.role === "GSO" &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status)

  // Check if BAC has reviewed this GSO voucher
  const bacHasReviewedGso = disbursement && 
    disbursement.createdBy.role === "GSO" &&
    disbursement.auditTrails.some(trail => 
      trail.action === "BAC_REVIEW" && 
      trail.user.role === "BAC"
    )

  // Budget review logic - only for GSO vouchers after BAC review
  const canBudgetReview = session.user.role === "BUDGET" && 
    disbursement && 
    disbursement.createdBy.role === "GSO" &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status) &&
    bacHasReviewedGso

  // Show Budget review button for GSO vouchers (but may be disabled)
  const showBudgetReviewButton = session.user.role === "BUDGET" && 
    disbursement && 
    disbursement.createdBy.role === "GSO" &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status)

  // Check if Budget has reviewed this GSO voucher
  const budgetHasReviewedGso = disbursement && 
    disbursement.createdBy.role === "GSO" &&
    disbursement.auditTrails.some(trail => 
      trail.action === "BUDGET_REVIEW" && 
      trail.user.role === "BUDGET"
    )

  // Accounting review logic - only for GSO vouchers after Budget review
  const canAccountingReview = session.user.role === "ACCOUNTING" && 
    disbursement && 
    disbursement.createdBy.role === "GSO" &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status) &&
    budgetHasReviewedGso

  // Show Accounting review button for GSO vouchers (but may be disabled)
  const showAccountingReviewButton = session.user.role === "ACCOUNTING" && 
    disbursement && 
    disbursement.createdBy.role === "GSO" &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status)

  // Check if Accounting has reviewed this GSO voucher
  const accountingHasReviewedGso = disbursement && 
    disbursement.createdBy.role === "GSO" &&
    disbursement.auditTrails.some(trail => 
      trail.action === "ACCOUNTING_REVIEW" && 
      trail.user.role === "ACCOUNTING"
    )

  // Treasury review logic - only for GSO vouchers after Accounting review
  const canTreasuryReview = session.user.role === "TREASURY" && 
    disbursement && 
    disbursement.createdBy.role === "GSO" &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status) &&
    accountingHasReviewedGso

  // Show Treasury review button for GSO vouchers (but may be disabled)
  const showTreasuryReviewButton = session.user.role === "TREASURY" && 
    disbursement && 
    disbursement.createdBy.role === "GSO" &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status)

  // Check if BAC has already reviewed this voucher
  const bacHasReviewed = disbursement && session.user.role === "BAC" &&
    disbursement.auditTrails.some(trail => 
      trail.action === "BAC_REVIEW" && 
      trail.userId === session.user.id
    )

  // Check if Budget has already reviewed this voucher
  const budgetHasReviewed = disbursement && session.user.role === "BUDGET" &&
    disbursement.auditTrails.some(trail => 
      trail.action === "BUDGET_REVIEW" && 
      trail.userId === session.user.id
    )

  // Check if Accounting has already reviewed this voucher
  const accountingHasReviewed = disbursement && session.user.role === "ACCOUNTING" &&
    disbursement.auditTrails.some(trail => 
      trail.action === "ACCOUNTING_REVIEW" && 
      trail.userId === session.user.id
    )

  // Check if Treasury has already reviewed this voucher
  const treasuryHasReviewed = disbursement && session.user.role === "TREASURY" &&
    disbursement.auditTrails.some(trail => 
      trail.action === "TREASURY_REVIEW" && 
      trail.userId === session.user.id
    )

  return (
    <MainLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => router.push("/disbursements")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{disbursement.title}</h1>
              <p className="text-gray-600">Disbursement Voucher #{disbursement.id.slice(-8)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(disbursement.status)}>
              {disbursement.status}
            </Badge>
            {canSubmit && (
              <Button 
                onClick={handleSubmitForReview}
                disabled={isSubmitting}
              >
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? "Submitting..." : "Submit for Review"}
              </Button>
            )}
            {canApproveNow && (
              <>
                <Button 
                  onClick={() => handleApproval("APPROVED")}
                  disabled={isApproving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {isApproving ? "Processing..." : 
                   effectiveApprovalLevel === 1 ? "Validate" :
                   effectiveApprovalLevel === 2 ? "Approve" : 
                   "Final Approve"}
                </Button>
                <Button 
                  onClick={() => handleApproval("REJECTED")}
                  disabled={isApproving}
                  variant="destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
            {canMayorReview && (
              <Button 
                onClick={handleReview}
                disabled={isApproving || mayorHasReviewed}
                className={mayorHasReviewed 
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-700"
                }
              >
                {mayorHasReviewed ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {isApproving ? "Processing..." : mayorHasReviewed ? "Reviewed" : "Review"}
              </Button>
            )}
            {showBacReviewButton && (
              <Button 
                onClick={handleBacReview}
                disabled={isApproving || bacHasReviewed || !mayorHasReviewedGso}
                className={bacHasReviewed 
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                  : !mayorHasReviewedGso
                  ? "bg-gray-300 hover:bg-gray-300 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700"
                }
                title={!mayorHasReviewedGso ? "Waiting for Mayor's review" : ""}
              >
                {bacHasReviewed ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : !mayorHasReviewedGso ? (
                  <Clock className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {isApproving ? "Processing..." : 
                 bacHasReviewed ? "BAC Reviewed" : 
                 !mayorHasReviewedGso ? "Awaiting Mayor Review" : 
                 "BAC Review"}
              </Button>
            )}
            {showBudgetReviewButton && (
              <Button 
                onClick={handleBudgetReview}
                disabled={isApproving || budgetHasReviewed || !bacHasReviewedGso}
                className={budgetHasReviewed 
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                  : !bacHasReviewedGso
                  ? "bg-gray-300 hover:bg-gray-300 cursor-not-allowed"
                  : "bg-orange-600 hover:bg-orange-700"
                }
                title={!bacHasReviewedGso ? "Waiting for BAC's review" : ""}
              >
                {budgetHasReviewed ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : !bacHasReviewedGso ? (
                  <Clock className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {isApproving ? "Processing..." : 
                 budgetHasReviewed ? "Budget Reviewed" : 
                 !bacHasReviewedGso ? "Awaiting BAC Review" : 
                 "Budget Review"}
              </Button>
            )}
            {showAccountingReviewButton && (
              <Button 
                onClick={handleAccountingReview}
                disabled={isApproving || accountingHasReviewed || !budgetHasReviewedGso}
                className={accountingHasReviewed 
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                  : !budgetHasReviewedGso
                  ? "bg-gray-300 hover:bg-gray-300 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
                }
                title={!budgetHasReviewedGso ? "Waiting for Budget Office review" : ""}
              >
                {accountingHasReviewed ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : !budgetHasReviewedGso ? (
                  <Clock className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {isApproving ? "Processing..." : 
                 accountingHasReviewed ? "Accounting Reviewed" : 
                 !budgetHasReviewedGso ? "Awaiting Budget Review" : 
                 "Accounting Review"}
              </Button>
            )}
            {showTreasuryReviewButton && (
              <Button 
                onClick={handleTreasuryReview}
                disabled={isApproving || treasuryHasReviewed || !accountingHasReviewedGso}
                className={treasuryHasReviewed 
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                  : !accountingHasReviewedGso
                  ? "bg-gray-300 hover:bg-gray-300 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
                }
                title={!accountingHasReviewedGso ? "Waiting for Accounting review" : ""}
              >
                {treasuryHasReviewed ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : !accountingHasReviewedGso ? (
                  <Clock className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {isApproving ? "Processing..." : 
                 treasuryHasReviewed ? "Treasury Reviewed" : 
                 !accountingHasReviewedGso ? "Awaiting Accounting Review" : 
                 "Treasury Review"}
              </Button>
            )}
            {canEdit && (
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Title</label>
                    <p className="text-sm text-gray-900">{disbursement.title}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Total Amount</label>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(disbursement.amount)}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Purpose</label>
                  <p className="text-sm text-gray-900">{disbursement.purpose}</p>
                </div>
                {disbursement.project && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Project</label>
                    <p className="text-sm text-gray-900">{disbursement.project}</p>
                  </div>
                )}
                {disbursement.remarks && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Remarks</label>
                    <p className="text-sm text-gray-900">{disbursement.remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="mr-2 h-5 w-5" />
                  Items ({disbursement.items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disbursement.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell colSpan={3} className="text-right font-medium">
                        Grand Total:
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {formatCurrency(disbursement.amount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Approvals */}
            {disbursement.approvals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Approvals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {disbursement.approvals.map((approval) => (
                      <div key={approval.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            approval.status === "APPROVED" ? "bg-green-500" :
                            approval.status === "REJECTED" ? "bg-red-500" : "bg-yellow-500"
                          }`} />
                          <div>
                            <p className="font-medium">{approval.approver.name}</p>
                            <p className="text-sm text-gray-600">Level {approval.level}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={approval.status === "APPROVED" ? "default" : 
                                        approval.status === "REJECTED" ? "destructive" : "secondary"}>
                            {approval.status}
                          </Badge>
                          {approval.approvedAt && (
                            <p className="text-xs text-gray-600 mt-1">
                              {formatDate(approval.approvedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status & Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(disbursement.status)}>
                      {disbursement.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Created By</label>
                  <p className="text-sm text-gray-900">{disbursement.createdBy.name}</p>
                  <p className="text-xs text-gray-600">{disbursement.createdBy.department}</p>
                </div>
                {disbursement.assignedTo && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Assigned To</label>
                    <p className="text-sm text-gray-900">{disbursement.assignedTo.name}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-600">Created</label>
                  <p className="text-sm text-gray-900">{formatDate(disbursement.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Updated</label>
                  <p className="text-sm text-gray-900">{formatDate(disbursement.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Audit Trail */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Activity Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {disbursement.auditTrails.slice(0, 10).map((trail) => {
                    const getActionDescription = (action: string) => {
                      switch (action.toUpperCase()) {
                        case "CREATE": return "created the disbursement"
                        case "SUBMIT": return "submitted for review"
                        case "APPROVE": return "approved the disbursement"
                        case "REJECT": return "rejected the disbursement"
                        case "UPDATE": return "updated the disbursement"
                        case "VALIDATE": return "validated the disbursement"
                        case "REVIEW": return "reviewed the disbursement"
                        case "BAC_REVIEW": return "reviewed the disbursement (BAC)"
                        case "BUDGET_REVIEW": return "reviewed the disbursement (Budget Office)"
                        case "ACCOUNTING_REVIEW": return "reviewed the disbursement (Accounting)"
                        case "TREASURY_REVIEW": return "reviewed the disbursement (Treasury)"
                        default: return `${action.toLowerCase()}d the disbursement`
                      }
                    }

                    const getActionColor = (action: string) => {
                      switch (action.toUpperCase()) {
                        case "CREATE": return "bg-blue-500"
                        case "SUBMIT": return "bg-yellow-500"
                        case "APPROVE": return "bg-green-500"
                        case "REJECT": return "bg-red-500"
                        case "UPDATE": return "bg-purple-500"
                        case "VALIDATE": return "bg-indigo-500"
                        case "REVIEW": return "bg-cyan-500"
                        case "BAC_REVIEW": return "bg-purple-600"
                        case "BUDGET_REVIEW": return "bg-orange-600"
                        case "ACCOUNTING_REVIEW": return "bg-green-600"
                        case "TREASURY_REVIEW": return "bg-indigo-600"
                        default: return "bg-gray-500"
                      }
                    }

                    return (
                      <div key={trail.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-3 h-3 ${getActionColor(trail.action)} rounded-full mt-1 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{trail.user.name}</span>{" "}
                            <span className="text-gray-600">({trail.user.role})</span>{" "}
                            {getActionDescription(trail.action)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            <Calendar className="inline w-3 h-3 mr-1" />
                            {formatDateTime(trail.timestamp)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  {disbursement.auditTrails.length > 10 && (
                    <p className="text-xs text-gray-500 text-center">
                      Showing latest 10 activities of {disbursement.auditTrails.length} total
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

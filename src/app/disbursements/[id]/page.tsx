"use client"

import { useEffect, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate, formatDateTime, getStatusColor } from "@/lib/utils"
import { ProgressBar } from "@/components/ui/progress-bar"
import { calculateProgress } from "@/lib/progress-utils"
import { 
  ArrowLeft, 
  Send, 
  Edit, 
  FileText, 
  User, 
  Calendar, 
  Banknote,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  MessageSquare,
  Plus,
  X
} from "lucide-react"
import { BacReview } from "@prisma/client"

interface DisbursementItem {
  id: string
  description: string
  quantity: number
  unit: string
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
  payee: string
  address: string
  amount: number
  particulars: string
  tags: string[]
  sourceOffice: string[]
  status: string
  remarks?: string
  createdAt: string
  updatedAt: string
  createdBy: User
  assignedTo?: User
  items: DisbursementItem[]
  approvals: Approval[]
  auditTrails: AuditTrail[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bacReviews: any[]
}

export default function DisbursementDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [disbursement, setDisbursement] = useState<Disbursement | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Memoized progress calculation that updates when disbursement changes
  const progressSteps = useMemo(() => {
    if (!disbursement) return []
    return calculateProgress(disbursement as unknown as Parameters<typeof calculateProgress>[0])
  }, [disbursement])
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [reviewRemarks, setReviewRemarks] = useState("")
  const [reviewType, setReviewType] = useState<"REVIEW" | "BUDGET_REVIEW" | "TREASURY_REVIEW" | "ACCOUNTING_REVIEW" | "BAC_REVIEW">("REVIEW")
  const [showRemarksDialog, setShowRemarksDialog] = useState(false)
  const [remarksText, setRemarksText] = useState("")
  const [selectedOffices, setSelectedOffices] = useState<string[]>([])
  const [availableOffices, setAvailableOffices] = useState<string[]>([])
  const [isSubmittingRemarks, setIsSubmittingRemarks] = useState(false)
  const [checkNumber, setCheckNumber] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [reviewPassword, setReviewPassword] = useState("")
  const [reviewPasswordError, setReviewPasswordError] = useState("")
  const [treasuryPassword, setTreasuryPassword] = useState("")
  const [treasuryPasswordError, setTreasuryPasswordError] = useState("")
  const [showTreasuryDialog, setShowTreasuryDialog] = useState(false)
  const [treasuryAction, setTreasuryAction] = useState<"CHECK_ISSUANCE" | "MARK_RELEASED" | null>(null)

  const handleEdit = () => {
    // Navigate to edit page with the disbursement ID
    router.push(`/disbursements/${id}/edit`)
  }

  const handleDelete = async () => {
    if (!deletePassword.trim()) {
      setPasswordError("Password is required")
      return
    }

    setIsDeleting(true)
    setPasswordError("")
    
    try {
      // First verify password
      const passwordResponse = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: deletePassword }),
      })

      if (!passwordResponse.ok) {
        const errorData = await passwordResponse.json()
        setPasswordError(errorData.error || "Invalid password")
        setIsDeleting(false)
        return
      }

      // If password is valid, proceed with deletion
      const response = await fetch(`/api/disbursements/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Redirect to disbursements list after successful deletion
        router.push("/disbursements")
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to delete disbursement")
      }
    } catch (error) {
      setError("An error occurred while deleting the disbursement")
    } finally {
      setIsDeleting(false)
    }
  }

  const fetchDisbursement = async () => {
    try {
      const response = await fetch(`/api/disbursements/${id}`)
      if (response.ok) {
        const data = await response.json()
        setDisbursement(data)
        setLoading(false) // Only set loading to false when we have data
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to fetch disbursement")
        setLoading(false) // Set loading to false on error
      }
    } catch (error) {
      setError("An error occurred while fetching the disbursement")
      setLoading(false) // Set loading to false on error
    }
  }

  const handleSubmitForReview = async () => {
    if (!disbursement) return

    if (!reviewPassword.trim()) {
      setReviewPasswordError("Password is required")
      return
    }

    setIsSubmitting(true)
    setError("")
    setReviewPasswordError("")

    try {
      // First verify password
      const passwordResponse = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: reviewPassword }),
      })

      if (!passwordResponse.ok) {
        const errorData = await passwordResponse.json()
        setReviewPasswordError(errorData.error || "Invalid password")
        setIsSubmitting(false)
        return
      }

      // If password is valid, proceed with submission
      const response = await fetch(`/api/disbursements/${id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
        setShowReviewDialog(false)
        setReviewPassword("")
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

    if (!reviewPassword.trim()) {
      setReviewPasswordError("Password is required")
      return
    }

    setIsApproving(true)
    setError("")
    setReviewPasswordError("")

    try {
      // First verify password
      const passwordResponse = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: reviewPassword }),
      })

      if (!passwordResponse.ok) {
        const errorData = await passwordResponse.json()
        setReviewPasswordError(errorData.error || "Invalid password")
        setIsApproving(false)
        return
      }

      // If password is valid, proceed with approval
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
        setShowReviewDialog(false)
        setReviewPassword("")
      } else {
        const errorData = await response.json()
        setError(errorData.error || `Failed to ${status?.toLowerCase()} disbursement`)
      }
    } catch (error) {
      setError(`An error occurred while ${status?.toLowerCase()}ing the disbursement`)
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

    if (!reviewPassword.trim()) {
      setReviewPasswordError("Password is required")
      return
    }

    setIsApproving(true)
    setError("")
    setReviewPasswordError("")

    try {
      // First verify password
      const passwordResponse = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: reviewPassword }),
      })

      if (!passwordResponse.ok) {
        const errorData = await passwordResponse.json()
        setReviewPasswordError(errorData.error || "Invalid password")
        setIsApproving(false)
        return
      }

      // If password is valid, proceed with BAC review
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
        setShowReviewDialog(false)
        setReviewPassword("")
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

    if (!reviewPassword.trim()) {
      setReviewPasswordError("Password is required")
      return
    }

    setIsApproving(true)
    setError("")
    setReviewPasswordError("")

    try {
      // First verify password
      const passwordResponse = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: reviewPassword }),
      })

      if (!passwordResponse.ok) {
        const errorData = await passwordResponse.json()
        setReviewPasswordError(errorData.error || "Invalid password")
        setIsApproving(false)
        return
      }

      // If password is valid, proceed with Budget review using standard approval API
      const response = await fetch(`/api/disbursements/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "APPROVED"
        }),
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
        setShowReviewDialog(false)
        setReviewPassword("")
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

    if (!reviewPassword.trim()) {
      setReviewPasswordError("Password is required")
      return
    }

    setIsApproving(true)
    setError("")
    setReviewPasswordError("")

    try {
      // First verify password
      const passwordResponse = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: reviewPassword }),
      })

      if (!passwordResponse.ok) {
        const errorData = await passwordResponse.json()
        setReviewPasswordError(errorData.error || "Invalid password")
        setIsApproving(false)
        return
      }

      // If password is valid, proceed with Accounting review using standard approval API
      const response = await fetch(`/api/disbursements/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "APPROVED"
        }),
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
        setShowReviewDialog(false)
        setReviewPassword("")
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

  const handleTreasuryPasswordVerification = async () => {
    if (!treasuryPassword.trim()) {
      setTreasuryPasswordError("Password is required")
      return
    }

    if (!treasuryAction) {
      setTreasuryPasswordError("No action selected")
      return
    }

    setIsApproving(true)
    setTreasuryPasswordError("")

    try {
      // First verify password
      const passwordResponse = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: treasuryPassword }),
      })

      if (!passwordResponse.ok) {
        const errorData = await passwordResponse.json()
        setTreasuryPasswordError(errorData.error || "Invalid password")
        setIsApproving(false)
        return
      }

      // If password is valid, proceed with Treasury action
      const response = await fetch(`/api/disbursements/${id}/treasury-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: treasuryAction,
          checkNumber: treasuryAction === "CHECK_ISSUANCE" ? checkNumber : undefined
        }),
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
        setCheckNumber("") // Clear check number after successful issuance
        setShowTreasuryDialog(false)
        setTreasuryPassword("")
        setTreasuryAction(null)
      } else {
        const errorData = await response.json()
        setTreasuryPasswordError(errorData.error || "Failed to process Treasury action")
      }
    } catch (error) {
      console.error("Error processing Treasury action:", error)
      setTreasuryPasswordError("Failed to process Treasury action")
    } finally {
      setIsApproving(false)
    }
  }

  const handleTreasuryAction = async (action: "CHECK_ISSUANCE" | "MARK_RELEASED") => {
    if (!disbursement) return

    if (action === "CHECK_ISSUANCE" && !checkNumber.trim()) {
      setError("Check number is required")
      return
    }

    setIsApproving(true)
    setError("")

    try {
      const response = await fetch(`/api/disbursements/${id}/treasury-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          checkNumber: action === "CHECK_ISSUANCE" ? checkNumber : undefined
        }),
      })

      if (response.ok) {
        const updatedDisbursement = await response.json()
        setDisbursement(updatedDisbursement)
        setCheckNumber("") // Clear check number after successful issuance
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to process Treasury action")
      }
    } catch (error) {
      console.error("Error processing Treasury action:", error)
      setError("Failed to process Treasury action")
    } finally {
      setIsApproving(false)
    }
  }

  const handleSubmitRemarks = async () => {
    if (!disbursement || !remarksText.trim() || selectedOffices.length === 0) return

    setIsSubmittingRemarks(true)
    setError("")

    try {
      const response = await fetch(`/api/disbursements/${id}/submit-remarks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          remarks: remarksText,
          targetOffices: selectedOffices
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setDisbursement(result.disbursement)
        setShowRemarksDialog(false)
        setRemarksText("")
        setSelectedOffices([])
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to submit remarks")
      }
    } catch (error) {
      console.error("Error submitting remarks:", error)
      setError("Failed to submit remarks")
    } finally {
      setIsSubmittingRemarks(false)
    }
  }

  const addOffice = (office: string) => {
    if (office && !selectedOffices.includes(office)) {
      setSelectedOffices([...selectedOffices, office])
    }
  }

  const removeOffice = (officeToRemove: string) => {
    setSelectedOffices(selectedOffices.filter(office => office !== officeToRemove))
  }

  const fetchAvailableOffices = async () => {
    try {
      const response = await fetch("/api/departments")
      if (response.ok) {
        const data = await response.json()
        setAvailableOffices(data)
      }
    } catch (error) {
      console.error("Error fetching offices:", error)
    }
  }

  useEffect(() => {
    if (id) {
      fetchDisbursement()
      fetchAvailableOffices()
    }
  }, [id])

  // Helper function to validate that disbursement data is complete
  const isDisbursementDataComplete = (disbursement: Disbursement) => {
    if (!disbursement) return false
    
    // Check basic required fields
    if (!disbursement.createdBy || 
        !disbursement.id || 
        !disbursement.payee || 
        !disbursement.status) {
      return false
    }
    
    // Check required arrays for progress calculation
    if (!disbursement.approvals || 
        !disbursement.auditTrails) {
      return false
    }
    
    // For GSO workflows, bacReviews is required
    if (disbursement.createdBy.role === "GSO" && !disbursement.bacReviews) {
      return false
    }
    
    return true
  }

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

  // Validate that we have all required data before rendering
  // This ensures the progress bar and all workflow logic work correctly
  if (!isDisbursementDataComplete(disbursement)) {
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
      const hasApprovalAtLevel = disbursement.approvals && disbursement.approvals.some(approval => 
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
    disbursement.approvals && // Add null check
    !disbursement.approvals.some(approval => 
      approval.approver.id === session.user.id && approval.level === effectiveApprovalLevel
    ) &&
    // Exclude roles that have their own specific review buttons
    !["ACCOUNTING", "BUDGET", "BAC", "MAYOR"].includes(session.user.role)

  // Check if previous levels are completed (for levels > 1)
  const previousLevelsCompleted = effectiveApprovalLevel === 1 || 
    (effectiveApprovalLevel && effectiveApprovalLevel > 1 && 
     disbursement.approvals && // Add null check
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
    ["GSO", "HR", "REQUESTER"].includes(disbursement?.createdBy?.role) &&
    ["PENDING"].includes(disbursement.status) &&
    disbursement.approvals && // Add null check
    !disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED"
    )

  // Check if Mayor has already reviewed this voucher
  const mayorHasReviewed = disbursement && 
    disbursement.approvals && // Add null check
    disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED"
    )

  // Check if Mayor has reviewed this GSO voucher (using approval levels OR audit trails)
  const mayorHasReviewedGsoByApproval = disbursement && 
    disbursement?.createdBy?.role === "GSO" &&
    disbursement.approvals && // Add null check
    disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED"
    )
    
  const mayorHasReviewedGsoByAudit = disbursement && 
    disbursement?.createdBy?.role === "GSO" &&
    disbursement.auditTrails && // Add null check
    disbursement.auditTrails.some(trail => 
      trail.action === "REVIEW" && trail.user.role === "MAYOR"
    )
    
  const mayorHasReviewedGso = mayorHasReviewedGsoByApproval || mayorHasReviewedGsoByAudit

  // Check if current BAC member has already reviewed this voucher
  const currentBacMemberHasReviewed = disbursement && 
    disbursement?.createdBy?.role === "GSO" &&
    disbursement.bacReviews && // Add null check
    disbursement.bacReviews.some(review => 
      review.reviewerId === session.user.id
    )

  // BAC review logic - only for GSO vouchers after Mayor review
  const canBacReview = session.user.role === "BAC" && 
    disbursement && 
    disbursement?.createdBy?.role === "GSO" &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status) &&
    mayorHasReviewedGso &&
    !currentBacMemberHasReviewed // Don't allow if already reviewed

  // Show BAC review button for GSO vouchers (but may be disabled)
  const showBacReviewButton = session.user.role === "BAC" && 
    disbursement && 
    disbursement?.createdBy?.role === "GSO" &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status) &&
    mayorHasReviewedGso

  // Debug logging for BAC review button
  console.log("BAC Review Button Debug:", {
    userRole: session.user.role,
    disbursementExists: !!disbursement,
    disbursementRole: disbursement?.createdBy?.role,
    disbursementStatus: disbursement?.status,
    mayorHasReviewedGso,
    showBacReviewButton,
    approvals: disbursement?.approvals,
    bacReviews: disbursement?.bacReviews
  })

  // Check if BAC has reviewed this GSO voucher (3 out of 5 members required)
  const bacHasReviewedGso = disbursement && 
    disbursement?.createdBy?.role === "GSO" &&
    disbursement.bacReviews && // Add null check
    disbursement.bacReviews.length >= 3

  // Budget review logic - only for GSO vouchers after BAC review
  const canBudgetReview = session.user.role === "BUDGET" && 
    disbursement && 
    disbursement?.createdBy?.role === "GSO" &&
    ["PENDING", "VALIDATED", "APPROVED"].includes(disbursement.status) &&
    bacHasReviewedGso

  // Show Budget review button logic
  const showBudgetReviewButton = session.user.role === "BUDGET" && 
    disbursement && 
    ["PENDING"].includes(disbursement.status) &&
    disbursement.approvals && // Add null check
    disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED" // Mayor approval
    ) && (
      // For GSO workflow: check for BAC completion (3+ reviews) and Budget not reviewed (Level 3)
      (disbursement?.createdBy?.role === "GSO" && 
       disbursement.bacReviews && disbursement.bacReviews.length >= 3 && // BAC completed
       !disbursement.approvals.some(approval => approval.level === 3 && approval.status === "APPROVED")) || // Budget not reviewed
      // For non-GSO workflow: check for Mayor approval (Level 1) and Budget not reviewed (Level 2)
      (disbursement?.createdBy?.role !== "GSO" && 
       !disbursement.approvals.some(approval => approval.level === 2 && approval.status === "APPROVED")) // Budget not reviewed
    )

  // Check if Budget has reviewed this voucher
  const budgetHasReviewedGso = disbursement && 
    disbursement.approvals && // Add null check
    disbursement.approvals.some(approval => 
      approval.level === 3 && approval.status === "APPROVED" // Budget is Level 3 in GSO workflow
    )

  // Show Accounting review button for all vouchers after Budget approval
  const showAccountingReviewButton = session.user.role === "ACCOUNTING" && 
    disbursement && 
    ["PENDING"].includes(disbursement.status) &&
    disbursement.approvals && // Add null check
    (
      // For GSO workflow: check for Budget approval (Level 3) and Accounting not reviewed (Level 4)
      (disbursement?.createdBy?.role === "GSO" && 
       disbursement.approvals.some(approval => approval.level === 3 && approval.status === "APPROVED") && // Budget approved
       !disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED")) || // Accounting not reviewed
      // For non-GSO workflow: check for Budget approval (Level 2) and Accounting not reviewed (Level 3)
      (disbursement?.createdBy?.role !== "GSO" && 
       disbursement.approvals.some(approval => approval.level === 2 && approval.status === "APPROVED") && // Budget approved
       !disbursement.approvals.some(approval => approval.level === 3 && approval.status === "APPROVED")) // Accounting not reviewed
    )

  // Check if Accounting has reviewed this voucher
  const accountingHasReviewed = disbursement && 
    disbursement.approvals && // Add null check
    (
      // For GSO workflow: Accounting is Level 4
      (disbursement?.createdBy?.role === "GSO" && 
       disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED")) ||
      // For non-GSO workflow: Accounting is Level 3
      (disbursement?.createdBy?.role !== "GSO" && 
       disbursement.approvals.some(approval => approval.level === 3 && approval.status === "APPROVED"))
    )

  // Check Treasury actions based on current state
  const hasCheckIssuance = disbursement?.auditTrails?.some(trail => 
    trail.action === "CHECK_ISSUANCE" && trail.user.role === "TREASURY"
  )
  const hasMarkReleased = disbursement?.auditTrails?.some(trail => 
    trail.action === "MARK_RELEASED" && trail.user.role === "TREASURY"
  )

  const canIssueCheck = session.user.role === "TREASURY" && 
    disbursement && 
    disbursement.approvals && // Add null check
    (
      // For GSO workflow: check for Accounting approval (Level 4)
      (disbursement?.createdBy?.role === "GSO" && 
       disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED")) ||
      // For non-GSO workflow: check for Accounting approval (Level 3)
      (disbursement?.createdBy?.role !== "GSO" && 
       disbursement.approvals.some(approval => approval.level === 3 && approval.status === "APPROVED"))
    ) && 
    !hasCheckIssuance && 
    !hasMarkReleased

  const canMarkReleased = session.user.role === "TREASURY" && 
    disbursement && 
    hasCheckIssuance && 
    !hasMarkReleased

  // Show Treasury action button for all vouchers after Accounting approval
  const showTreasuryActionButton = session.user.role === "TREASURY" && 
    disbursement && 
    disbursement.approvals && // Add null check
    (
      // For GSO workflow: check for Accounting approval (Level 4)
      (disbursement?.createdBy?.role === "GSO" && 
       disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED")) ||
      // For non-GSO workflow: check for Accounting approval (Level 3)
      (disbursement?.createdBy?.role !== "GSO" && 
       disbursement.approvals.some(approval => approval.level === 3 && approval.status === "APPROVED"))
    )

  // Check if BAC has already reviewed this voucher
  const bacHasReviewed = disbursement && session.user.role === "BAC" &&
    disbursement?.auditTrails?.some(trail => 
      trail.action === "BAC_REVIEW" && 
      trail.userId === session.user.id
    )

  // Check if Budget has already reviewed this voucher
  const budgetHasReviewed = disbursement && 
    disbursement.approvals && // Add null check
    (
      // For GSO workflow: Budget is Level 3
      (disbursement?.createdBy?.role === "GSO" && 
       disbursement.approvals.some(approval => approval.level === 3 && approval.status === "APPROVED")) ||
      // For non-GSO workflow: Budget is Level 2
      (disbursement?.createdBy?.role !== "GSO" && 
       disbursement.approvals.some(approval => approval.level === 2 && approval.status === "APPROVED"))
    )

  // Check if Treasury has already reviewed this voucher
  const treasuryHasReviewed = disbursement && session.user.role === "TREASURY" &&
    disbursement?.auditTrails?.some(trail => 
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
              <h1 className="text-2xl font-bold text-gray-900">{disbursement?.payee}</h1>
              <p className="text-gray-600">Disbursement Voucher #{disbursement?.id?.slice(-8)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(disbursement?.status)}>
              {disbursement?.status}
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
                onClick={() => setShowReviewDialog(true)}
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
                onClick={() => setShowReviewDialog(true)}
                disabled={isApproving || currentBacMemberHasReviewed || !mayorHasReviewedGso}
                className={currentBacMemberHasReviewed 
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                  : !mayorHasReviewedGso
                  ? "bg-gray-300 hover:bg-gray-300 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700"
                }
                title={!mayorHasReviewedGso ? "Waiting for Mayor's review" : 
                       currentBacMemberHasReviewed ? "You have already reviewed this voucher" : ""}
              >
                {currentBacMemberHasReviewed ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : !mayorHasReviewedGso ? (
                  <Clock className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {isApproving ? "Processing..." : 
                 currentBacMemberHasReviewed ? "You Reviewed" : 
                 !mayorHasReviewedGso ? "Awaiting Mayor Review" : 
                 "BAC Review"}
              </Button>
            )}
            
            {/* BAC Review Status Display */}
            {disbursement?.createdBy.role === "GSO" && disbursement?.bacReviews && (
              <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">
                      BAC Reviews: {disbursement?.bacReviews?.length || 0}/5 members
                    </span>
                  </div>
                  <div className="text-sm text-purple-600">
                    {(disbursement?.bacReviews?.length || 0) >= 3 ? (
                      <span className="text-green-600 font-medium">✓ Complete (3+ reviews)</span>
                    ) : (
                      <span>Need {3 - (disbursement?.bacReviews?.length || 0)} more reviews</span>
                    )}
                  </div>
                </div>
                {(disbursement?.bacReviews?.length || 0) > 0 && (
                  <div className="mt-2 text-xs text-purple-600">
                    Reviewed by: {disbursement?.bacReviews?.map((review) => review.reviewer.name).join(", ") || "None"}
                  </div>
                )}
              </div>
            )}
            {showBudgetReviewButton && (
              <Button 
                onClick={() => setShowReviewDialog(true)}
                disabled={isApproving || budgetHasReviewed || budgetHasReviewedGso}
                className={budgetHasReviewed || budgetHasReviewedGso 
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                  : "bg-orange-600 hover:bg-orange-700"
                }
              >
                {budgetHasReviewed || budgetHasReviewedGso ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {isApproving ? "Processing..." : 
                 budgetHasReviewed || budgetHasReviewedGso ? "Budget Reviewed" : 
                 "Budget Review"}
              </Button>
            )}
            {showAccountingReviewButton && (
              <Button 
                onClick={() => setShowReviewDialog(true)}
                disabled={isApproving || accountingHasReviewed}
                className={accountingHasReviewed 
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                  : "bg-green-600 hover:bg-green-700"
                }
              >
                {accountingHasReviewed ? (
                  <CheckCircle className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {isApproving ? "Processing..." : 
                 accountingHasReviewed ? "Accounting Reviewed" : 
                 "Accounting Review"}
              </Button>
            )}
            {showTreasuryActionButton && (
              <div className="space-y-2">
                {canIssueCheck && (
                  <div className="flex items-center space-x-2">
                    <Input
                      placeholder="Enter check number"
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value)}
                      className="w-48"
                    />
                    <Button 
                      onClick={() => {
                        if (!checkNumber.trim()) {
                          setError("Check number is required")
                          return
                        }
                        setTreasuryAction("CHECK_ISSUANCE")
                        setShowTreasuryDialog(true)
                      }}
                      disabled={isApproving || !checkNumber.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isApproving ? "Processing..." : "Check Number Issuance"}
                    </Button>
                  </div>
                )}
                
                {canMarkReleased && (
                  <Button 
                    onClick={() => {
                      setTreasuryAction("MARK_RELEASED")
                      setShowTreasuryDialog(true)
                    }}
                    disabled={isApproving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isApproving ? "Processing..." : "Available for Release"}
                  </Button>
                )}
                
                {hasMarkReleased && (
                  <Button 
                    disabled
                    className="bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Released
                  </Button>
                )}
              </div>
            )}
            {canEdit && (
              <Button variant="outline" onClick={handleEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {canEdit && (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteDialog(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => setShowRemarksDialog(true)}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Submit Remarks
            </Button>
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
            {/* Progress Bar */}
            <Card key={`progress-${disbursement?.id}-${disbursement?.status}-${disbursement?.auditTrails?.length || 0}`}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Approval Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProgressBar steps={progressSteps} />
              </CardContent>
            </Card>
            
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
                    <label className="text-sm font-medium text-gray-600">Payee</label>
                    <p className="text-sm text-gray-900">{disbursement.payee}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Address</label>
                    <p className="text-sm text-gray-900">{disbursement.address}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Total Amount</label>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(disbursement.amount)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Particulars</label>
                  <p className="text-sm text-gray-900">{disbursement.particulars}</p>
                </div>
                {disbursement.tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Tags</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {disbursement.tags.map((tag, index) => (
                        <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {disbursement.sourceOffice.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Source Office</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {disbursement.sourceOffice.map((office, index) => (
                        <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm">
                          {office}
                        </span>
                      ))}
                    </div>
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
                      <TableHead className="text-center">Unit</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disbursement.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-center">{item.unit}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell colSpan={4} className="text-right font-medium">
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
                  <p className="text-sm text-gray-900">{disbursement?.createdBy?.name}</p>
                  <p className="text-xs text-gray-600">{disbursement?.createdBy?.department}</p>
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
                    const getActionDescription = (action: string, trail: { newValues?: { checkNumber?: string; releaseDate?: string; treasuryActionComments?: string } }) => {
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
                        case "CHECK_ISSUANCE": 
                          const checkNumber = trail.newValues?.checkNumber
                          return checkNumber ? `issued check #${checkNumber}` : "issued check"
                        case "MARK_RELEASED": return "released the disbursement"
                        case "SUBMIT_REMARKS": return "submitted remarks to source offices"
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
                        case "CHECK_ISSUANCE": return "bg-emerald-500"
                        case "MARK_RELEASED": return "bg-green-600"
                        case "SUBMIT_REMARKS": return "bg-blue-600"
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
                            {getActionDescription(trail.action, trail)}
                          </p>
                          
                          {/* Show remarks details for SUBMIT_REMARKS action */}
                          {trail.action === "SUBMIT_REMARKS" && trail.newValues && (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                              <div className="mb-2">
                                <span className="text-xs font-medium text-blue-800">Remarks:</span>
                                <p className="text-sm text-blue-900 mt-1">{trail.newValues.remarks}</p>
                              </div>
                              {trail.newValues.targetOffices && trail.newValues.targetOffices.length > 0 && (
                                <div>
                                  <span className="text-xs font-medium text-blue-800">Sent to:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {trail.newValues.targetOffices.map((office: string, index: number) => (
                                      <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                        {office}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Show check details for CHECK_ISSUANCE action */}
                          {trail.action === "CHECK_ISSUANCE" && trail.newValues && (
                            <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                              <div className="mb-2">
                                <span className="text-xs font-medium text-emerald-800">Check Number:</span>
                                <p className="text-sm font-mono text-emerald-900 mt-1">{trail.newValues.checkNumber}</p>
                              </div>
                              {trail.newValues.treasuryActionComments && (
                                <div>
                                  <span className="text-xs font-medium text-emerald-800">Comments:</span>
                                  <p className="text-sm text-emerald-900 mt-1">{trail.newValues.treasuryActionComments}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Show release details for MARK_RELEASED action */}
                          {trail.action === "MARK_RELEASED" && trail.newValues && (
                            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                              <div className="mb-2">
                                <span className="text-xs font-medium text-green-800">Released Date:</span>
                                <p className="text-sm text-green-900 mt-1">{formatDateTime(trail.newValues.releaseDate)}</p>
                              </div>
                              {trail.newValues.treasuryActionComments && (
                                <div>
                                  <span className="text-xs font-medium text-green-800">Comments:</span>
                                  <p className="text-sm text-green-900 mt-1">{trail.newValues.treasuryActionComments}</p>
                                </div>
                              )}
                            </div>
                          )}
                          
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

        {/* Remarks Dialog */}
        <Dialog open={showRemarksDialog} onOpenChange={setShowRemarksDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <MessageSquare className="mr-2 h-5 w-5" />
                Submit Remarks
              </DialogTitle>
              <DialogDescription>
                Submit remarks to specific offices regarding this disbursement voucher.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Remarks *
                </label>
                <Textarea
                  placeholder="Enter your remarks or feedback..."
                  value={remarksText}
                  onChange={(e) => setRemarksText(e.target.value)}
                  rows={4}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Target Offices *
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Select onValueChange={addOffice}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select an office to notify" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOffices
                          .filter(office => !selectedOffices.includes(office))
                          .map((office) => (
                            <SelectItem key={office} value={office}>
                              {office}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedOffices.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedOffices.map((office, index) => (
                        <div key={index} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm">
                          {office}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-blue-200"
                            onClick={() => removeOffice(office)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRemarksDialog(false)
                  setRemarksText("")
                  setSelectedOffices([])
                }}
                disabled={isSubmittingRemarks}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitRemarks}
                disabled={isSubmittingRemarks || !remarksText.trim() || selectedOffices.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmittingRemarks ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Remarks
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Review Confirmation Dialog */}
        <Dialog open={showReviewDialog} onOpenChange={(open) => {
          setShowReviewDialog(open)
          if (!open) {
            setReviewPassword("")
            setReviewPasswordError("")
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Eye className="mr-2 h-5 w-5" />
                Confirm Review Action
              </DialogTitle>
              <DialogDescription>
                Please enter your password to confirm this review action.
                <br />
                <strong>Disbursement:</strong> {disbursement?.payee}
                <br />
                <strong>Amount:</strong> {formatCurrency(Number(disbursement?.amount || 0))}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Enter your password to confirm review *
                </label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={reviewPassword}
                  onChange={(e) => {
                    setReviewPassword(e.target.value)
                    setReviewPasswordError("")
                  }}
                  className={reviewPasswordError ? "border-red-500" : ""}
                />
                {reviewPasswordError && (
                  <p className="text-sm text-red-600 mt-1">{reviewPasswordError}</p>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowReviewDialog(false)
                  setReviewPassword("")
                  setReviewPasswordError("")
                }}
                disabled={isApproving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (session.user.role === "BAC") {
                    handleBacReview()
                  } else if (session.user.role === "BUDGET") {
                    handleBudgetReview()
                  } else if (session.user.role === "MAYOR") {
                    handleApproval("APPROVED")
                  } else if (session.user.role === "ACCOUNTING") {
                    handleApproval("APPROVED")
                  }
                }}
                disabled={isApproving || !reviewPassword.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isApproving ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Confirm Review
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={(open) => {
          setShowDeleteDialog(open)
          if (!open) {
            setDeletePassword("")
            setPasswordError("")
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center text-red-600">
                <XCircle className="mr-2 h-5 w-5" />
                Delete Disbursement Voucher
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this disbursement voucher? This action cannot be undone.
                <br />
                <strong>Payee:</strong> {disbursement?.payee}
                <br />
                <strong>Amount:</strong> {formatCurrency(Number(disbursement?.amount || 0))}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Enter your password to confirm deletion *
                </label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value)
                    setPasswordError("")
                  }}
                  className={passwordError ? "border-red-500" : ""}
                />
                {passwordError && (
                  <p className="text-sm text-red-600 mt-1">{passwordError}</p>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setDeletePassword("")
                  setPasswordError("")
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || !deletePassword.trim()}
              >
                {isDeleting ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Delete
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Treasury Action Confirmation Dialog */}
        <Dialog open={showTreasuryDialog} onOpenChange={(open) => {
          setShowTreasuryDialog(open)
          if (!open) {
            setTreasuryPassword("")
            setTreasuryPasswordError("")
            setTreasuryAction(null)
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Banknote className="mr-2 h-5 w-5" />
                Confirm Treasury Action
              </DialogTitle>
              <DialogDescription>
                Please enter your password to confirm this Treasury action.
                <br />
                <strong>Disbursement:</strong> {disbursement?.payee}
                <br />
                <strong>Amount:</strong> {formatCurrency(Number(disbursement?.amount || 0))}
                <br />
                <strong>Action:</strong> {treasuryAction === "CHECK_ISSUANCE" ? "Check Number Issuance" : "Mark as Released"}
                {treasuryAction === "CHECK_ISSUANCE" && (
                  <>
                    <br />
                    <strong>Check Number:</strong> {checkNumber}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Enter your password to confirm Treasury action *
                </label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={treasuryPassword}
                  onChange={(e) => {
                    setTreasuryPassword(e.target.value)
                    setTreasuryPasswordError("")
                  }}
                  className={treasuryPasswordError ? "border-red-500" : ""}
                />
                {treasuryPasswordError && (
                  <p className="text-sm text-red-600 mt-1">{treasuryPasswordError}</p>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTreasuryDialog(false)
                  setTreasuryPassword("")
                  setTreasuryPasswordError("")
                  setTreasuryAction(null)
                }}
                disabled={isApproving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTreasuryPasswordVerification}
                disabled={isApproving || !treasuryPassword.trim()}
                className={treasuryAction === "CHECK_ISSUANCE" ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}
              >
                {isApproving ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Banknote className="mr-2 h-4 w-4" />
                    Confirm {treasuryAction === "CHECK_ISSUANCE" ? "Check Issuance" : "Release"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

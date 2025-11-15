"use client"

import { useEffect, useState, useMemo, useCallback, ReactNode } from "react"
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
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getCurrentReviewer } from "@/lib/utils"
import { ProgressBar } from "@/components/ui/progress-bar"
import { calculateProgress } from "@/lib/progress-utils"
import { 
  ArrowLeft, 
  Send, 
  Edit, 
  FileText, 
  FileSignature,
  User, 
  Calendar, 
  Banknote,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  MessageSquare,
  Wallet,
  X,
  Ban
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
  checkNumber?: string | null
  releaseDate?: string | null
  releaseRecipient?: string | null
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
  const [treasuryReleaseRecipient, setTreasuryReleaseRecipient] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [reviewPassword, setReviewPassword] = useState("")
  const [reviewPasswordError, setReviewPasswordError] = useState("")
  const [treasuryPassword, setTreasuryPassword] = useState("")
  const [treasuryPasswordError, setTreasuryPasswordError] = useState("")
  const [showPasswords, setShowPasswords] = useState({
    review: false,
    delete: false,
    treasury: false
  })
  const [showTreasuryDialog, setShowTreasuryDialog] = useState(false)
  const [treasuryAction, setTreasuryAction] = useState<"CHECK_ISSUANCE" | "MARK_RELEASED" | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelError, setCancelError] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    if (disbursement?.releaseRecipient) {
      setTreasuryReleaseRecipient(disbursement.releaseRecipient)
    }
  }, [disbursement?.releaseRecipient])

  const rawSourceOffices = disbursement?.sourceOffice as unknown
  const sourceOfficesArray: string[] = Array.isArray(rawSourceOffices)
    ? (rawSourceOffices as string[])
    : typeof rawSourceOffices === "string" && rawSourceOffices.length > 0
    ? [rawSourceOffices as string]
    : []

  const sourceOffices = sourceOfficesArray
    .map((office) => office.trim())
    .filter((office) => office.length > 0)

  const cancellationDetails = useMemo(() => {
    if (!disbursement?.auditTrails) {
      return null
    }

    const trail = disbursement.auditTrails.find((entry) => entry.action === "CANCELLED")
    if (!trail) {
      return null
    }

    return {
      reason: trail.newValues?.cancellationReason as string | undefined,
      by: trail.user?.name,
      role: trail.user?.role,
      timestamp: trail.timestamp
    }
  }, [disbursement?.auditTrails])

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

  const handleCancelDisbursement = async () => {
    if (!cancelReason.trim()) {
      setCancelError("Please provide a reason for cancelling this voucher.")
      return
    }

    setIsCancelling(true)
    setCancelError("")

    try {
      const response = await fetch(`/api/disbursements/${id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reason: cancelReason.trim()
        })
      })

      if (!response.ok) {
        let message = "Failed to cancel disbursement"
        try {
          const errorData = await response.json()
          if (errorData?.error) {
            message = errorData.error
          } else if (Array.isArray(errorData?.details) && errorData.details.length > 0) {
            message = errorData.details.map((detail: { message?: string }) => detail.message).filter(Boolean).join(", ")
          }
        } catch {}
        setCancelError(message)
        return
      }

      const updatedDisbursement = await response.json()
      setDisbursement(updatedDisbursement)
      setShowCancelDialog(false)
      setCancelReason("")
      setCancelError("")
      await fetchDisbursement()
    } catch (error) {
      console.error("Error cancelling disbursement:", error)
      setCancelError("An error occurred while cancelling the disbursement. Please try again.")
    } finally {
      setIsCancelling(false)
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

  const handleSubmitForReview = useCallback(async () => {
    if (!disbursement) {
      setError("Disbursement data is not available yet.")
      return
    }

    try {
      setIsSubmitting(true)
      setError("")

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
  }, [disbursement, id])

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
        const responseData = await response.json()
        console.log("Approval response data:", responseData)
        console.log("Disbursement data:", responseData.disbursement)
        setDisbursement(responseData.disbursement)
        setShowReviewDialog(false)
        setReviewPassword("")
        setShowPasswords(prev => ({ ...prev, review: false }))
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

  const handleSecretaryReview = async () => {
    if (!disbursement) return

    setIsApproving(true)
    setError("")

    try {
      console.log(`Starting Secretary review for disbursement: ${id}`)
      
      // Proceed with Secretary review with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      const response = await fetch(`/api/disbursements/${id}/secretary-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "SECRETARY_REVIEWED",
          remarks: reviewPassword.trim() || undefined // Use password field as remarks for now
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      console.log(`Secretary review response status: ${response.status}`)

      if (response.ok) {
        const updatedDisbursement = await response.json()
        console.log(`Secretary review successful, updating disbursement:`, updatedDisbursement)
        setDisbursement(updatedDisbursement)
        setShowReviewDialog(false)
        setReviewPassword("")
        setShowPasswords(prev => ({ ...prev, review: false }))
        
        // Force refresh the page to ensure UI updates
        setTimeout(() => {
          window.location.reload()
        }, 1000)
        
        console.log(`Secretary review completed successfully`)
      } else {
        const errorData = await response.json()
        console.error(`Secretary review failed:`, errorData)
        setError(errorData.error || "Failed to Secretary review voucher")
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error Secretary reviewing disbursement:", error)
      if (error.name === 'AbortError') {
        setError("Request timed out. Please try again.")
      } else {
        setError("Failed to Secretary review voucher")
      }
    } finally {
      setIsApproving(false)
      console.log(`Secretary review process finished`)
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
        setShowPasswords(prev => ({ ...prev, review: false }))
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
        const responseData = await response.json()
        console.log("Budget review response data:", responseData)
        console.log("Budget review disbursement data:", responseData.disbursement)
        setDisbursement(responseData.disbursement)
        setShowReviewDialog(false)
        setReviewPassword("")
        setShowPasswords(prev => ({ ...prev, review: false }))
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

      // If password is valid, proceed with Accounting review using dedicated API
      const response = await fetch(`/api/disbursements/${id}/accounting-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "ACCOUNTING_REVIEWED",
          comments: reviewPassword.trim() || undefined
        }),
      })

      if (response.ok) {
        const responseData = await response.json()
        console.log("Accounting review response data:", responseData)
        console.log("Accounting review disbursement data:", responseData.disbursement)
        setDisbursement(responseData.disbursement)
        setShowReviewDialog(false)
        setReviewPassword("")
        setShowPasswords(prev => ({ ...prev, review: false }))
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

    if (treasuryAction === "MARK_RELEASED" && !treasuryReleaseRecipient.trim()) {
      setTreasuryPasswordError("Receiver name is required")
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
          checkNumber: treasuryAction === "CHECK_ISSUANCE" ? checkNumber : undefined,
          releaseRecipient: treasuryAction === "MARK_RELEASED" ? treasuryReleaseRecipient.trim() : undefined
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setTreasuryPasswordError(errorData.error || "Failed to process Treasury action")
        return
      }

      const updatedDisbursement = await response.json()
      setDisbursement(updatedDisbursement)
      setShowTreasuryDialog(false)
      setTreasuryPassword("")
      setTreasuryAction(null)
      setShowPasswords(prev => ({ ...prev, treasury: false }))
      setCheckNumber("") // Clear check number after successful issuance
      setTreasuryReleaseRecipient("")
      await fetchDisbursement()
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

    if (action === "MARK_RELEASED" && !treasuryReleaseRecipient.trim()) {
      setError("Receiver name is required")
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
          checkNumber: action === "CHECK_ISSUANCE" ? checkNumber : undefined,
          releaseRecipient: action === "MARK_RELEASED" ? treasuryReleaseRecipient.trim() : undefined
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Failed to process Treasury action")
        return
      }

      const updatedDisbursement = await response.json()
      setDisbursement(updatedDisbursement)
      setShowTreasuryDialog(false)
      setTreasuryPassword("")
      setTreasuryAction(null)
      setShowPasswords(prev => ({ ...prev, treasury: false }))
      setCheckNumber("") // Clear check number after successful issuance
      setTreasuryReleaseRecipient("")
      await fetchDisbursement()
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

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Failed to submit remarks")
        return
      }

      setShowRemarksDialog(false)
      setRemarksText("")
      setSelectedOffices([])

      // Refresh disbursement data to ensure UI reflects the latest remarks without manual reload
      await fetchDisbursement()
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

  const cancellableStatuses = ["PENDING", "VALIDATED", "APPROVED"]
  const canCancel = cancellableStatuses.includes(disbursement.status) &&
    (disbursement.createdBy.id === session.user.id || ["ADMIN", "ACCOUNTING", "BUDGET", "TREASURY", "MAYOR", "DEPARTMENT_HEAD", "FINANCE_HEAD"].includes(session.user.role))

  // Determine approval permissions based on role and current status
  const getApprovalLevel = (role: string): number | null => {
    switch (role) {
      case "SECRETARY": return 1
      case "MAYOR": return 2
      case "BUDGET": return disbursement?.createdBy?.role === "GSO" ? 4 : 3
      case "ACCOUNTING": return disbursement?.createdBy?.role === "GSO" ? 5 : 4
      case "TREASURY": return disbursement?.createdBy?.role === "GSO" ? 6 : 5
      default: return null
    }
  }

  const userApprovalLevel = getApprovalLevel(session.user.role)
  const isAdmin = session.user.role === "ADMIN"
  
  // For admin, determine what level they can approve based on current status and existing approvals
  const getAdminApprovalLevel = (): number | null => {
    if (!isAdmin) return null
    
    // Find the next level that needs approval
    const maxLevel = disbursement?.createdBy?.role === "GSO" ? 6 : 5
    for (let level = 1; level <= maxLevel; level++) {
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
    !["ACCOUNTING", "BUDGET", "BAC", "MAYOR", "SECRETARY"].includes(session.user.role)

  // Check if previous levels are completed (for levels > 1)
  const previousLevelsCompleted = effectiveApprovalLevel === 1 || 
    (effectiveApprovalLevel && effectiveApprovalLevel > 1 && 
     disbursement.approvals && // Add null check
     (() => {
       // For GSO workflow, handle special cases
       if (disbursement?.createdBy?.role === "GSO") {
         if (effectiveApprovalLevel === 4) {
           // Budget (Level 4) needs: Secretary (Level 1), Mayor (Level 2), and BAC (3+ reviews)
           const secretaryApproved = disbursement.approvals.some(approval => 
             approval.level === 1 && approval.status === "APPROVED"
           )
           const mayorApproved = disbursement.approvals.some(approval => 
             approval.level === 2 && approval.status === "APPROVED"
           )
           const bacCompleted = disbursement.bacReviews && disbursement.bacReviews.length >= 3
           
           return secretaryApproved && mayorApproved && bacCompleted
         } else if (effectiveApprovalLevel === 5) {
           // Accounting (Level 5) needs: Secretary (Level 1), Mayor (Level 2), BAC (3+ reviews), Budget (Level 4)
           const secretaryApproved = disbursement.approvals.some(approval => 
             approval.level === 1 && approval.status === "APPROVED"
           )
           const mayorApproved = disbursement.approvals.some(approval => 
             approval.level === 2 && approval.status === "APPROVED"
           )
           const bacCompleted = disbursement.bacReviews && disbursement.bacReviews.length >= 3
           const budgetApproved = disbursement.approvals.some(approval => 
             approval.level === 4 && approval.status === "APPROVED"
           )
           
           return secretaryApproved && mayorApproved && bacCompleted && budgetApproved
         } else if (effectiveApprovalLevel === 6) {
           // Treasury (Level 6) needs: Secretary (Level 1), Mayor (Level 2), BAC (3+ reviews), Budget (Level 4), Accounting (Level 5)
           const secretaryApproved = disbursement.approvals.some(approval => 
             approval.level === 1 && approval.status === "APPROVED"
           )
           const mayorApproved = disbursement.approvals.some(approval => 
             approval.level === 2 && approval.status === "APPROVED"
           )
           const bacCompleted = disbursement.bacReviews && disbursement.bacReviews.length >= 3
           const budgetApproved = disbursement.approvals.some(approval => 
             approval.level === 4 && approval.status === "APPROVED"
           )
           const accountingApproved = disbursement.approvals.some(approval => 
             approval.level === 5 && approval.status === "APPROVED"
           )
           
           return secretaryApproved && mayorApproved && bacCompleted && budgetApproved && accountingApproved
         }
       }
       
       // For all other cases, check approval records normally
       return Array.from({ length: effectiveApprovalLevel - 1 }, (_, i) => i + 1)
         .every(level => 
           disbursement.approvals.some(approval => 
             approval.level === level && approval.status === "APPROVED"
           )
         )
     })()
    )

  const canApproveNow = canApprove && previousLevelsCompleted

  // Secretary review logic
  const canSecretaryReview = session.user.role === "SECRETARY" && 
    disbursement && 
    ["PENDING"].includes(disbursement.status) &&
    disbursement.approvals && // Add null check
    !disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED"
    )

  // Check if Secretary has already reviewed this voucher
  const secretaryHasReviewed = disbursement && 
    disbursement.approvals && // Add null check
    disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED"
    )

  // Mayor review logic
  const canMayorReview = session.user.role === "MAYOR" && 
    disbursement && 
    ["GSO", "HR", "REQUESTER"].includes(disbursement?.createdBy?.role) &&
    ["PENDING"].includes(disbursement.status) &&
    disbursement.approvals && // Add null check
    disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED" // Secretary must have approved first
    ) &&
    !disbursement.approvals.some(approval => 
      approval.level === 2 && approval.status === "APPROVED"
    )

  // Check if Mayor has already reviewed this voucher
  const mayorHasReviewed = disbursement && 
    disbursement.approvals && // Add null check
    disbursement.approvals.some(approval => 
      approval.level === 2 && approval.status === "APPROVED"
    )

  // Check if Mayor has reviewed this GSO voucher (using approval levels OR audit trails)
  const mayorHasReviewedGsoByApproval = disbursement && 
    disbursement?.createdBy?.role === "GSO" &&
    disbursement.approvals && // Add null check
    disbursement.approvals.some(approval => 
      approval.level === 2 && approval.status === "APPROVED"
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
    // Check for Secretary approval (Level 1) and Mayor approval (Level 2)
    disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED" // Secretary approval
    ) &&
    disbursement.approvals.some(approval => 
      approval.level === 2 && approval.status === "APPROVED" // Mayor approval
    ) && (
      // For GSO workflow: check for BAC completion (3+ reviews) and Budget not reviewed (Level 4)
      (disbursement?.createdBy?.role === "GSO" && 
       disbursement.bacReviews && disbursement.bacReviews.length >= 3 && // BAC completed
       !disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED")) || // Budget not reviewed (Level 4 in GSO)
      // For non-GSO workflow: check for Budget not reviewed (Level 3)
      (disbursement?.createdBy?.role !== "GSO" && 
       !disbursement.approvals.some(approval => approval.level === 3 && approval.status === "APPROVED")) // Budget not reviewed (Level 3 in non-GSO)
    )

  // Check if Budget has reviewed this voucher
  const budgetHasReviewedGso = disbursement && 
    disbursement.approvals && // Add null check
    disbursement.approvals.some(approval => 
      approval.level === 4 && approval.status === "APPROVED" // Budget is Level 4 in GSO workflow
    )

  const budgetHasReviewed = disbursement && 
    disbursement.approvals && // Add null check
    disbursement.approvals.some(approval => 
      approval.level === 3 && approval.status === "APPROVED" // Budget is Level 3 in non-GSO workflow
    )

  // Show Accounting review button for all vouchers after Budget approval
  const showAccountingReviewButton = session.user.role === "ACCOUNTING" && 
    disbursement && 
    ["PENDING"].includes(disbursement.status) &&
    disbursement.approvals && // Add null check
    // Check for Secretary approval (Level 1) and Mayor approval (Level 2)
    disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED" // Secretary approval
    ) &&
    disbursement.approvals.some(approval => 
      approval.level === 2 && approval.status === "APPROVED" // Mayor approval
    ) &&
    (
      // For GSO workflow: check for BAC completion (3+ reviews), Budget approval (Level 4), and Accounting not reviewed (Level 5)
      (disbursement?.createdBy?.role === "GSO" && 
       disbursement.bacReviews && disbursement.bacReviews.length >= 3 && // BAC completed
       disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED") && // Budget approved (Level 4)
       !disbursement.approvals.some(approval => approval.level === 5 && approval.status === "APPROVED")) || // Accounting not reviewed (Level 5)
      // For non-GSO workflow: check for Budget approval (Level 3) and Accounting not reviewed (Level 4)
      (disbursement?.createdBy?.role !== "GSO" && 
       disbursement.approvals.some(approval => approval.level === 3 && approval.status === "APPROVED") && // Budget approved (Level 3)
       !disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED")) // Accounting not reviewed (Level 4)
    )

  // Check if Accounting has reviewed this voucher
  const accountingHasReviewed = disbursement && 
    disbursement.approvals && // Add null check
    (
      // For GSO workflow: Accounting is Level 5
      (disbursement?.createdBy?.role === "GSO" && 
       disbursement.approvals.some(approval => approval.level === 5 && approval.status === "APPROVED")) ||
      // For non-GSO workflow: Accounting is Level 4
      (disbursement?.createdBy?.role !== "GSO" && 
       disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED"))
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
    disbursement.status !== "CANCELLED" &&
    disbursement.approvals && // Add null check
    // Check for Secretary approval (Level 1) and Mayor approval (Level 2)
    disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED" // Secretary approval
    ) &&
    disbursement.approvals.some(approval => 
      approval.level === 2 && approval.status === "APPROVED" // Mayor approval
    ) &&
    (
      // For GSO workflow: check for BAC completion (3+ reviews), Budget approval (Level 4), Accounting approval (Level 5)
      (disbursement?.createdBy?.role === "GSO" && 
       disbursement.bacReviews && disbursement.bacReviews.length >= 3 && // BAC completed
       disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED") && // Budget approved (Level 4)
       disbursement.approvals.some(approval => approval.level === 5 && approval.status === "APPROVED")) || // Accounting approved (Level 5)
      // For non-GSO workflow: check for Budget approval (Level 3), Accounting approval (Level 4)
      (disbursement?.createdBy?.role !== "GSO" && 
       disbursement.approvals.some(approval => approval.level === 3 && approval.status === "APPROVED") && // Budget approved (Level 3)
       disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED")) // Accounting approved (Level 4)
    ) && 
    !hasCheckIssuance && 
    !hasMarkReleased

  const canMarkReleased = session.user.role === "TREASURY" && 
    disbursement && 
    disbursement.status !== "CANCELLED" &&
    hasCheckIssuance && 
    !hasMarkReleased

  // Show Treasury action button for all vouchers after Accounting approval
  const showTreasuryActionButton = session.user.role === "TREASURY" && 
    disbursement && 
    disbursement.status !== "CANCELLED" &&
    disbursement.approvals && // Add null check
    // Check for Secretary approval (Level 1) and Mayor approval (Level 2)
    disbursement.approvals.some(approval => 
      approval.level === 1 && approval.status === "APPROVED" // Secretary approval
    ) &&
    disbursement.approvals.some(approval => 
      approval.level === 2 && approval.status === "APPROVED" // Mayor approval
    ) &&
    (
      // For GSO workflow: check for BAC completion (3+ reviews), Budget approval (Level 4), Accounting approval (Level 5)
      (disbursement?.createdBy?.role === "GSO" && 
       disbursement.bacReviews && disbursement.bacReviews.length >= 3 && // BAC completed
       disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED") && // Budget approved (Level 4)
       disbursement.approvals.some(approval => approval.level === 5 && approval.status === "APPROVED")) || // Accounting approved (Level 5)
      // For non-GSO workflow: check for Budget approval (Level 3), Accounting approval (Level 4)
      (disbursement?.createdBy?.role !== "GSO" && 
       disbursement.approvals.some(approval => approval.level === 3 && approval.status === "APPROVED") && // Budget approved (Level 3)
       disbursement.approvals.some(approval => approval.level === 4 && approval.status === "APPROVED")) // Accounting approved (Level 4)
    )

  // Check if BAC has already reviewed this voucher
  const bacHasReviewed = disbursement && session.user.role === "BAC" &&
    disbursement?.auditTrails?.some(trail => 
      trail.action === "BAC_REVIEW" && 
      trail.userId === session.user.id
    )


  // Check if Treasury has already reviewed this voucher
  const treasuryHasReviewed = disbursement && session.user.role === "TREASURY" &&
    disbursement?.auditTrails?.some(trail => 
      trail.action === "TREASURY_REVIEW" && 
      trail.userId === session.user.id
    )

  const workflowActions: { key: string; node: ReactNode }[] = []

  if (canSubmit) {
    workflowActions.push({
      key: "submit-for-review",
      node: (
        <Button
          onClick={async () => {
            setError("")
            await handleSubmitForReview()
          }}
          disabled={isSubmitting}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg disabled:bg-indigo-300 disabled:text-white disabled:shadow-none px-4 py-2 font-semibold transition-transform duration-150 hover:-translate-y-0.5"
        >
          <Send className="mr-2 h-4 w-4" />
          {isSubmitting ? "Submitting..." : "Submit for Review"}
        </Button>
      )
    })
  }

  if (canApproveNow) {
    workflowActions.push({
      key: "approve",
      node: (
        <Button
          onClick={() => handleApproval("APPROVED")}
          disabled={isApproving}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          {isApproving ? "Processing..." : 
           effectiveApprovalLevel === 1 ? "Validate" :
           effectiveApprovalLevel === 2 ? "Approve" : 
           "Final Approve"}
        </Button>
      )
    })

    workflowActions.push({
      key: "reject",
      node: (
        <Button
          onClick={() => handleApproval("REJECTED")}
          disabled={isApproving}
          variant="destructive"
          className="w-full"
        >
          <XCircle className="mr-2 h-4 w-4" />
          Reject
        </Button>
      )
    })
  }

  if (canSecretaryReview) {
    workflowActions.push({
      key: "secretary-review",
      node: (
        <Button
          onClick={() => setShowReviewDialog(true)}
          disabled={isApproving || secretaryHasReviewed}
          className={`w-full ${
            secretaryHasReviewed 
              ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {secretaryHasReviewed ? (
            <CheckCircle className="mr-2 h-4 w-4" />
          ) : (
            <Eye className="mr-2 h-4 w-4" />
          )}
          {isApproving ? "Processing..." : secretaryHasReviewed ? "Secretary Reviewed" : "Secretary Review"}
        </Button>
      )
    })
  }

  if (canMayorReview) {
    workflowActions.push({
      key: "mayor-review",
      node: (
        <Button
          onClick={() => setShowReviewDialog(true)}
          disabled={isApproving || mayorHasReviewed}
          className={`w-full ${
            mayorHasReviewed 
              ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {mayorHasReviewed ? (
            <CheckCircle className="mr-2 h-4 w-4" />
          ) : (
            <Eye className="mr-2 h-4 w-4" />
          )}
          {isApproving ? "Processing..." : mayorHasReviewed ? "Reviewed" : "Review"}
        </Button>
      )
    })
  }

  if (showBacReviewButton) {
    workflowActions.push({
      key: "bac-review",
      node: (
        <Button
          onClick={() => setShowReviewDialog(true)}
          disabled={isApproving || currentBacMemberHasReviewed || !mayorHasReviewedGso}
          className={`w-full ${
            currentBacMemberHasReviewed
              ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
              : !mayorHasReviewedGso
              ? "bg-gray-300 hover:bg-gray-300 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700"
          }`}
          title={
            !mayorHasReviewedGso ? "Waiting for Mayor's review" : 
            currentBacMemberHasReviewed ? "You have already reviewed this voucher" : ""
          }
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
      )
    })
  }

  if (showBudgetReviewButton) {
    workflowActions.push({
      key: "budget-review",
      node: (
        <Button
          onClick={() => setShowReviewDialog(true)}
          disabled={isApproving || budgetHasReviewed || budgetHasReviewedGso}
          className={`w-full ${
            budgetHasReviewed || budgetHasReviewedGso
              ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
              : "bg-orange-600 hover:bg-orange-700"
          }`}
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
      )
    })
  }

  if (showAccountingReviewButton) {
    workflowActions.push({
      key: "accounting-review",
      node: (
        <Button
          onClick={() => setShowReviewDialog(true)}
          disabled={isApproving || accountingHasReviewed}
          className={`w-full ${
            accountingHasReviewed
              ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
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
      )
    })
  }

  if (canEdit) {
    workflowActions.push({
      key: "edit",
      node: (
        <Button variant="outline" onClick={handleEdit} className="w-full">
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </Button>
      )
    })

    workflowActions.push({
      key: "delete",
      node: (
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
          className="w-full"
        >
          <XCircle className="mr-2 h-4 w-4" />
          Delete
        </Button>
      )
    })
  }

  if (canCancel) {
    workflowActions.push({
      key: "cancel",
      node: (
        <Button
          variant="destructive"
          onClick={() => {
            setShowCancelDialog(true)
            setCancelError("")
          }}
          className="w-full bg-slate-600 hover:bg-slate-700 text-white shadow-sm"
        >
          <Ban className="mr-2 h-4 w-4" />
          Cancel Voucher
        </Button>
      )
    })
  }

  workflowActions.push({
    key: "remarks",
    node: (
      <Button
        variant="outline"
        onClick={() => setShowRemarksDialog(true)}
        className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        Submit Remarks
      </Button>
    )
  })

  const showBacStatus = Boolean(disbursement?.createdBy?.role === "GSO" && Array.isArray(disbursement?.bacReviews))
  const showWorkflowCard = workflowActions.length > 0 || showBacStatus

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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge className={getStatusColor(disbursement?.status)}>
              {disbursement?.status}
            </Badge>
            {/* Current Reviewer Information */}
            {(() => {
              const currentReviewer = getCurrentReviewer(disbursement)
              return currentReviewer ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-blue-800">Current Reviewer:</span>
                  <span className="text-sm text-blue-700">{currentReviewer.displayName}</span>
                  <span className="text-xs text-blue-600">({currentReviewer.status})</span>
                </div>
              ) : null
            })()}
          </div>
        </div>

        {disbursement.status === "CANCELLED" && (
          <Alert className="border border-slate-200 bg-slate-50 text-slate-800">
            <Ban className="h-4 w-4 text-slate-600" />
            <AlertDescription>
              This disbursement voucher was cancelled
              {cancellationDetails?.by ? ` by ${cancellationDetails.by}` : "" }
              {cancellationDetails?.role ? ` (${cancellationDetails.role})` : ""}
              {cancellationDetails?.timestamp ? ` on ${formatDateTime(cancellationDetails.timestamp)}.` : "."}
              {cancellationDetails?.reason && (
                <span className="block text-sm mt-2 text-slate-700">
                  Reason: <span className="font-medium text-slate-900">{cancellationDetails.reason}</span>
                </span>
              )}
              {!cancellationDetails?.reason && (
                <span className="block text-sm mt-2 text-slate-600">
                  No cancellation reason was provided.
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {(showWorkflowCard || showTreasuryActionButton) && (
          <div className={`grid gap-4 ${showTreasuryActionButton ? "lg:grid-cols-3" : ""}`}>
            {showWorkflowCard && (
              <Card
                className={`border border-slate-200 shadow-sm ${showTreasuryActionButton ? "lg:col-span-2" : "lg:col-span-3"}`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <FileSignature className="h-5 w-5 text-indigo-600" />
                    Workflow Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {workflowActions.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {workflowActions.map(({ key, node }) => (
                        <div key={key} className="flex">{node}</div>
                      ))}
                    </div>
                  )}

                  {showBacStatus && (
                    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">
                            BAC Reviews: {disbursement?.bacReviews?.length || 0}/5 members
                          </span>
                        </div>
                        <div className="text-sm text-purple-600">
                          {(disbursement?.bacReviews?.length || 0) >= 3 ? (
                            <span className="text-green-600 font-medium">✓ Complete (3+ reviews)</span>
                          ) : (
                            <span>Need {Math.max(3 - (disbursement?.bacReviews?.length || 0), 0)} more reviews</span>
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
                </CardContent>
              </Card>
            )}

            {showTreasuryActionButton && (
              <Card className="border border-indigo-100 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-indigo-700">
                    <Wallet className="h-5 w-5" />
                    Treasury Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {canIssueCheck && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Check Details</label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <Input
                          placeholder="Enter check number"
                          value={checkNumber}
                          onChange={(e) => setCheckNumber(e.target.value)}
                          className="sm:flex-1 border-gray-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-400"
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
                          className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-md"
                        >
                          {isApproving ? "Processing..." : "Issue Check"}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Verify the check number before issuing to avoid discrepancies.
                      </p>
                    </div>
                  )}

                  {canMarkReleased && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Receiver Name</label>
                      <Input
                        placeholder="Enter the name of the person receiving the funds"
                        value={treasuryReleaseRecipient}
                        onChange={(e) => {
                          setTreasuryReleaseRecipient(e.target.value)
                          if (error) setError("")
                        }}
                        disabled={isApproving}
                        className="border-gray-200 shadow-sm focus:border-emerald-400 focus:ring-emerald-400"
                      />
                      <p className="text-xs text-gray-500">
                        This will be recorded in the release audit trail.
                      </p>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3">
                    {canMarkReleased && (
                      <Button
                        onClick={() => {
                          if (!treasuryReleaseRecipient.trim()) {
                            setError("Receiver name is required")
                            return
                          }
                          setTreasuryAction("MARK_RELEASED")
                          setShowTreasuryDialog(true)
                        }}
                        disabled={isApproving || !treasuryReleaseRecipient.trim()}
                        className="h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-md disabled:from-emerald-300 disabled:to-emerald-300"
                      >
                        {isApproving ? "Processing..." : "Mark as Released"}
                      </Button>
                    )}

                    {hasMarkReleased && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700 space-y-1">
                        <div className="flex items-center gap-2 font-semibold">
                          <CheckCircle className="h-5 w-5" />
                          Voucher Released
                        </div>
                        {disbursement.releaseRecipient && (
                          <p className="text-sm text-green-800">
                            Received by: <span className="font-medium">{disbursement.releaseRecipient}</span>
                          </p>
                        )}
                        {disbursement.releaseDate && (
                          <p className="text-xs text-green-700">
                            Released on {formatDateTime(disbursement.releaseDate)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

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
                {disbursement.checkNumber && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Check Number</label>
                    <p className="text-sm text-gray-900">{disbursement.checkNumber}</p>
                  </div>
                )}
                {disbursement.releaseRecipient && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Released To</label>
                    <p className="text-sm text-gray-900">{disbursement.releaseRecipient}</p>
                    {disbursement.releaseDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Released on {formatDateTime(disbursement.releaseDate)}
                      </p>
                    )}
                  </div>
                )}
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
                {sourceOffices.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Source Offices</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {sourceOffices.map((office, index) => (
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
                {disbursement.status === "CANCELLED" && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-700">Cancellation Details</p>
                    {cancellationDetails?.reason && (
                      <p className="text-sm text-slate-900 mt-1">{cancellationDetails.reason}</p>
                    )}
                    <p className="text-xs text-slate-600 mt-2">
                      Cancelled by {cancellationDetails?.by ?? "Unknown user"}
                      {cancellationDetails?.role ? ` (${cancellationDetails.role})` : ""}
                      {cancellationDetails?.timestamp ? ` on ${formatDateTime(cancellationDetails.timestamp)}` : ""}
                    </p>
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
                    const getActionDescription = (action: string, trail: { newValues?: { checkNumber?: string; releaseDate?: string; releaseRecipient?: string; treasuryActionComments?: string; cancellationReason?: string } }) => {
                      switch (action.toUpperCase()) {
                        case "CREATE": return "created the disbursement"
                        case "SUBMIT": return "submitted for review"
                        case "APPROVE": return "approved the disbursement"
                        case "REJECT": return "rejected the disbursement"
                        case "UPDATE": return "updated the disbursement"
                        case "VALIDATE": return "validated the disbursement"
                        case "SECRETARY_REVIEW": return "reviewed the disbursement (Secretary)"
                        case "REVIEW": return "reviewed the disbursement"
                        case "BAC_REVIEW": return "reviewed the disbursement (BAC)"
                        case "BUDGET_REVIEW": return "reviewed the disbursement (Budget Office)"
                        case "ACCOUNTING_REVIEW": return "reviewed the disbursement (Accounting)"
                        case "TREASURY_REVIEW": return "reviewed the disbursement (Treasury)"
                        case "CHECK_ISSUANCE": 
                          const checkNumber = trail.newValues?.checkNumber
                          return checkNumber ? `issued check #${checkNumber}` : "issued check"
                        case "MARK_RELEASED":
                          return trail.newValues?.releaseRecipient
                            ? `released the disbursement to ${trail.newValues.releaseRecipient}`
                            : "released the disbursement"
                        case "CANCELLED": return "cancelled the disbursement"
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
                        case "SECRETARY_REVIEW": return "bg-indigo-600"
                        case "REVIEW": return "bg-cyan-500"
                        case "BAC_REVIEW": return "bg-purple-600"
                        case "BUDGET_REVIEW": return "bg-orange-600"
                        case "ACCOUNTING_REVIEW": return "bg-green-600"
                        case "TREASURY_REVIEW": return "bg-indigo-600"
                        case "CHECK_ISSUANCE": return "bg-emerald-500"
                        case "MARK_RELEASED": return "bg-green-600"
                        case "CANCELLED": return "bg-slate-500"
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
                            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md space-y-2">
                              <div>
                                <span className="text-xs font-medium text-green-800">Released Date:</span>
                                <p className="text-sm text-green-900 mt-1">
                                  {trail.newValues.releaseDate ? formatDateTime(trail.newValues.releaseDate) : "Not recorded"}
                                </p>
                              </div>
                              {trail.newValues.releaseRecipient && (
                                <div>
                                  <span className="text-xs font-medium text-green-800">Received By:</span>
                                  <p className="text-sm text-green-900 mt-1">{trail.newValues.releaseRecipient}</p>
                                </div>
                              )}
                              {trail.newValues.treasuryActionComments && (
                                <div>
                                  <span className="text-xs font-medium text-green-800">Comments:</span>
                                  <p className="text-sm text-green-900 mt-1">{trail.newValues.treasuryActionComments}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Show cancellation details */}
                          {trail.action === "CANCELLED" && (
                            <div className="mt-2 p-3 bg-slate-100 border border-slate-200 rounded-md">
                              <span className="text-xs font-medium text-slate-800">Reason:</span>
                              <p className="text-sm text-slate-900 mt-1">
                                {trail.newValues?.cancellationReason ? trail.newValues.cancellationReason : "No cancellation reason provided."}
                              </p>
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
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Select onValueChange={addOffice}>
                      <SelectTrigger className="flex-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white shadow-sm">
                        <SelectValue placeholder="Select an office to notify" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-md max-h-60 overflow-y-auto">
                        {availableOffices
                          .filter(office => !selectedOffices.includes(office))
                          .map((office) => (
                            <SelectItem 
                              key={office} 
                              value={office}
                              className="hover:bg-blue-50 focus:bg-blue-50 cursor-pointer py-2 px-3"
                            >
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-gray-700">{office}</span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedOffices.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">Selected Offices:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedOffices.map((office, index) => (
                          <div key={index} className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span>{office}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 hover:bg-blue-200 rounded-full"
                              onClick={() => removeOffice(office)}
                            >
                              <X className="h-3 w-3 text-blue-600" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500">
                    Select offices that will receive notifications about this disbursement
                  </p>
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
            setShowPasswords(prev => ({ ...prev, review: false }))
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
                <div className="relative">
                  <Input
                    type={showPasswords.review ? "text" : "password"}
                    placeholder="Enter your password"
                    value={reviewPassword}
                    onChange={(e) => {
                      setReviewPassword(e.target.value)
                      setReviewPasswordError("")
                    }}
                    className={`pr-10 ${reviewPasswordError ? "border-red-500" : ""}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPasswords(prev => ({ ...prev, review: !prev.review }))}
                  >
                    {showPasswords.review ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
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
                  setShowPasswords(prev => ({ ...prev, review: false }))
                }}
                disabled={isApproving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (session.user.role === "SECRETARY") {
                    handleSecretaryReview()
                  } else if (session.user.role === "BAC") {
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

        {/* Cancel Confirmation Dialog */}
        <Dialog
          open={showCancelDialog}
          onOpenChange={(open) => {
            setShowCancelDialog(open)
            if (!open) {
              setCancelReason("")
              setCancelError("")
              setIsCancelling(false)
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Ban className="mr-2 h-5 w-5" />
                Cancel Disbursement Voucher
              </DialogTitle>
              <DialogDescription>
                Cancelling this voucher will halt the workflow and notify relevant offices. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Cancellation Reason *
                </label>
                <Textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Explain why this disbursement voucher is being cancelled"
                  rows={4}
                />
                {cancelError && (
                  <p className="text-sm text-red-600 mt-2">{cancelError}</p>
                )}
              </div>
              <p className="text-xs text-slate-500">
                All reviewers and involved departments will be notified about this cancellation.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false)
                  setCancelReason("")
                  setCancelError("")
                }}
                disabled={isCancelling}
              >
                Keep Voucher
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelDisbursement}
                disabled={isCancelling}
                className="bg-slate-700 hover:bg-slate-800"
              >
                {isCancelling ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Ban className="mr-2 h-4 w-4" />
                    Confirm Cancel
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
            setShowPasswords(prev => ({ ...prev, delete: false }))
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
                <div className="relative">
                  <Input
                    type={showPasswords.delete ? "text" : "password"}
                    placeholder="Enter your password"
                    value={deletePassword}
                    onChange={(e) => {
                      setDeletePassword(e.target.value)
                      setPasswordError("")
                    }}
                    className={`pr-10 ${passwordError ? "border-red-500" : ""}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPasswords(prev => ({ ...prev, delete: !prev.delete }))}
                  >
                    {showPasswords.delete ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
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
                  setShowPasswords(prev => ({ ...prev, delete: false }))
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
            setShowPasswords(prev => ({ ...prev, treasury: false }))
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
                {treasuryAction === "MARK_RELEASED" && (
                  <>
                    <br />
                    <strong>Receiver:</strong> {treasuryReleaseRecipient || "—"}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Enter your password to confirm Treasury action *
                </label>
                <div className="relative">
                  <Input
                    type={showPasswords.treasury ? "text" : "password"}
                    placeholder="Enter your password"
                    value={treasuryPassword}
                    onChange={(e) => {
                      setTreasuryPassword(e.target.value)
                      setTreasuryPasswordError("")
                    }}
                    className={`pr-10 ${treasuryPasswordError ? "border-red-500" : ""}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPasswords(prev => ({ ...prev, treasury: !prev.treasury }))}
                  >
                    {showPasswords.treasury ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
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
                  setShowPasswords(prev => ({ ...prev, treasury: false }))
                }}
                disabled={isApproving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTreasuryPasswordVerification}
                disabled={
                  isApproving ||
                  !treasuryPassword.trim() ||
                  (treasuryAction === "MARK_RELEASED" && !treasuryReleaseRecipient.trim())
                }
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

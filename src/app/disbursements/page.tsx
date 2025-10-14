"use client"

import { useEffect, useState, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { MainLayout } from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import { FileText, Plus, Search, Filter, Eye } from "lucide-react"

interface Disbursement {
  id: string
  payee: string
  amount: number
  status: string
  createdAt: string
  createdBy: {
    name: string
    department?: string
  }
  assignedTo?: {
    name: string
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

function DisbursementsContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [disbursements, setDisbursements] = useState<Disbursement[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")
  const [departmentFilter, setDepartmentFilter] = useState("")

  const fetchDisbursements = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10"
      })
      
      if (statusFilter) params.append("status", statusFilter)
      if (departmentFilter) params.append("department", departmentFilter)

      const response = await fetch(`/api/disbursements?${params}`)
      if (response.ok) {
        const data = await response.json()
        setDisbursements(data.disbursements)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("Error fetching disbursements:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchDisbursements()
    }
  }, [session, statusFilter, departmentFilter])

  const handleStatusFilter = (status: string) => {
    const actualStatus = status === "ALL" ? "" : status
    setStatusFilter(actualStatus)
    const params = new URLSearchParams(searchParams.toString())
    if (actualStatus) {
      params.set("status", actualStatus)
    } else {
      params.delete("status")
    }
    router.push(`/disbursements?${params}`)
  }

  const filteredDisbursements = disbursements.filter(disbursement =>
    disbursement?.payee?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    disbursement.createdBy.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!session) {
    return null
  }

  const statusOptions = [
    { value: "ALL", label: "All Status" },
    { value: "DRAFT", label: "Draft" },
    { value: "PENDING", label: "Pending" },
    { value: "VALIDATED", label: "Validated" },
    { value: "APPROVED", label: "Approved" },
    { value: "RELEASED", label: "Released" },
    { value: "REJECTED", label: "Rejected" }
  ]

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Disbursement Vouchers</h1>
            <p className="text-gray-600">
              Manage and track disbursement requests
            </p>
          </div>
          {session.user.role === "REQUESTER" && (
            <Button asChild>
              <Link href="/create">
                <Plus className="mr-2 h-4 w-4" />
                Create New Voucher
              </Link>
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Filter className="mr-2 h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by title or requester..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter || "ALL"} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Disbursements Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Loading disbursements...
              </div>
            ) : filteredDisbursements.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p className="text-lg font-medium">No disbursements found</p>
                <p className="text-sm">
                  {session.user.role === "REQUESTER" 
                    ? "Create your first disbursement voucher to get started."
                    : "No disbursements match your current filters."
                  }
                </p>
                {session.user.role === "REQUESTER" && (
                  <Button asChild className="mt-4">
                    <Link href="/create">
                      <Plus className="mr-2 h-4 w-4" />
                      Create New Voucher
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payee</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDisbursements.map((disbursement) => (
                    <TableRow key={disbursement.id}>
                      <TableCell>
                        <div className="font-medium">{disbursement.payee}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">
                          {formatCurrency(disbursement.amount)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(disbursement.status)}>
                          {disbursement.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{disbursement.createdBy.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {disbursement.createdBy.department || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {formatDate(disbursement.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/disbursements/${disbursement.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} results
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDisbursements(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDisbursements(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}

export default function DisbursementsPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="p-6">
          <div className="text-center py-8 text-gray-500">
            Loading disbursements...
          </div>
        </div>
      </MainLayout>
    }>
      <DisbursementsContent />
    </Suspense>
  )
}

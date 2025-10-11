/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import { MainLayout } from "@/components/layout/main-layout"
import Link from "next/link"
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  Users,
  Calendar
} from "lucide-react"

interface DashboardStats {
  totalVouchers: number
  pendingVouchers: number
  approvedVouchers: number
  rejectedVouchers: number
  totalAmount: number
  monthlyAmount: number
}

interface RecentVoucher {
  id: string
  title: string
  amount: number
  status: string
  createdAt: string
  createdBy: {
    name: string
    department?: string
  }
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentVouchers, setRecentVouchers] = useState<RecentVoucher[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch recent disbursements
        const response = await fetch("/api/disbursements?limit=5")
        if (response.ok) {
          const data = await response.json()
          setRecentVouchers(data.disbursements)
          
          // Calculate stats from the data
          const totalVouchers = data.pagination.total
          const pending = data.disbursements.filter((v: any) => v.status === "PENDING").length
          const approved = data.disbursements.filter((v: any) => v.status === "APPROVED" || v.status === "RELEASED").length
          const rejected = data.disbursements.filter((v: any) => v.status === "REJECTED").length
          const totalAmount = data.disbursements.reduce((sum: number, v: any) => sum + parseFloat(v.amount), 0)
          
          // For monthly amount, we'd need a separate API call or filter by date
          const currentMonth = new Date().getMonth()
          const monthlyAmount = data.disbursements
            .filter((v: any) => new Date(v.createdAt).getMonth() === currentMonth)
            .reduce((sum: number, v: any) => sum + parseFloat(v.amount), 0)

          setStats({
            totalVouchers,
            pendingVouchers: pending,
            approvedVouchers: approved,
            rejectedVouchers: rejected,
            totalAmount,
            monthlyAmount
          })
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (session) {
      fetchDashboardData()
    }
  }, [session])

  if (!session) {
    return null
  }

  const statCards = [
    {
      title: "Total Vouchers",
      value: stats?.totalVouchers || 0,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Pending Approval",
      value: stats?.pendingVouchers || 0,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50"
    },
    {
      title: "Approved",
      value: stats?.approvedVouchers || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Rejected",
      value: stats?.rejectedVouchers || 0,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50"
    }
  ]

  const amountCards = [
    {
      title: "Total Amount",
      value: formatCurrency(stats?.totalAmount || 0),
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50"
    },
    {
      title: "This Month",
      value: formatCurrency(stats?.monthlyAmount || 0),
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ]

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">
              Welcome back, {session.user.name}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="px-3 py-1">
              {session.user.role.replace("_", " ")}
            </Badge>
            {session.user.department && (
              <Badge variant="secondary" className="px-3 py-1">
                {session.user.department}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card) => (
            <Card key={card.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {card.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {loading ? "..." : card.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${card.bgColor}`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Amount Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {amountCards.map((card) => (
            <Card key={card.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {card.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {loading ? "..." : card.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${card.bgColor}`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Vouchers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Disbursement Vouchers</CardTitle>
                <CardDescription>
                  Latest vouchers in the system
                </CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link href="/disbursements">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Loading recent vouchers...
              </div>
            ) : recentVouchers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No vouchers found
              </div>
            ) : (
              <div className="space-y-4">
                {recentVouchers.map((voucher) => (
                  <div
                    key={voucher.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <FileText className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {voucher.title}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-sm text-gray-500">
                              {voucher.createdBy.name}
                            </p>
                            {voucher.createdBy.department && (
                              <>
                                <span className="text-gray-300">•</span>
                                <p className="text-sm text-gray-500">
                                  {voucher.createdBy.department}
                                </p>
                              </>
                            )}
                            <span className="text-gray-300">•</span>
                            <p className="text-sm text-gray-500">
                              {formatDate(voucher.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(voucher.amount)}
                        </p>
                      </div>
                      <Badge className={getStatusColor(voucher.status)}>
                        {voucher.status}
                      </Badge>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/disbursements/${voucher.id}`}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        {["REQUESTER", "GSO", "HR"].includes(session.user.role) && (
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks you can perform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <Button asChild>
                  <Link href="/create">
                    <FileText className="mr-2 h-4 w-4" />
                    Create New Voucher
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/disbursements?status=DRAFT">
                    View Draft Vouchers
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}

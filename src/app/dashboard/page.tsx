/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate, getStatusColor, getCurrentReviewer, getTotalProcessingTime } from "@/lib/utils"
import { MainLayout } from "@/components/layout/main-layout"
import Link from "next/link"
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Banknote,
  TrendingUp,
  Plus,
  Ban
} from "lucide-react"
import { useDashboardStats, useRecentDisbursements } from "@/hooks/use-data"
import { DashboardStatsSkeleton, AmountCardsSkeleton, DisbursementListSkeleton } from "@/components/ui/skeletons"

interface DashboardStats {
  totalVouchers: number
  pendingVouchers: number
  approvedVouchers: number
  rejectedVouchers: number
  cancelledVouchers: number
  totalAmount: number
  monthlyAmount: number
}

interface RecentVoucher {
  id: string
  payee: string
  particulars: string
  amount: number
  status: string
  createdAt: string
  updatedAt?: string
  createdBy: {
    name: string
    department?: string
    role: string
  }
  approvals: Array<{
    level: number
    status: string
    approver: {
      name: string
      role: string
    }
  }>
  bacReviews?: Array<{
    status: string
    reviewer: {
      name: string
      role: string
    }
  }>
  auditTrails: Array<{
    action: string
    user: {
      role: string
    }
  }>
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: recentVouchers, isLoading: recentLoading, error: recentError } = useRecentDisbursements()
  const [bacRequiredApprovals, setBacRequiredApprovals] = useState(3)

  // Fetch BAC required approvals setting
  useEffect(() => {
    const fetchBacRequiredApprovals = async () => {
      try {
        const response = await fetch("/api/settings/bac-required")
        if (response.ok) {
          const data = await response.json()
          if (data.value) {
            setBacRequiredApprovals(data.value)
          }
        }
      } catch (error) {
        console.error("Error fetching BAC required approvals:", error)
      }
    }
    fetchBacRequiredApprovals()
  }, [])

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
    },
    {
      title: "Cancelled",
      value: stats?.cancelledVouchers || 0,
      icon: Ban,
      color: "text-red-600",
      bgColor: "bg-red-50"
    }
  ]

  const amountCards = [
    {
      title: "Total Amount",
      value: formatCurrency(stats?.totalAmount || 0),
      icon: Banknote,
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
          <div className="absolute inset-0 bg-[url('/socorro-aerial-view.jpg')] bg-cover bg-center opacity-10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-indigo-900/80 to-purple-900/80"></div>
          
          <div className="relative px-6 py-12 sm:py-16">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-sm rounded-2xl blur-xl"></div>
                    <div className="relative bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 shadow-2xl">
                      <img 
                        src="/socorro-logo.png" 
                        alt="Socorro Logo" 
                        className="h-16 w-auto object-contain"
                        onError={(e) => {
                          console.error("Failed to load logo. Check if /socorro-logo.png exists in public folder");
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg">
                      Welcome back, {session.user.name?.split(' ')[0]}!
                    </h1>
                    <p className="text-blue-100 text-lg mt-1">
                      Municipality of Socorro - Disbursement Tracking System
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="px-4 py-2 text-sm bg-white/20 backdrop-blur-sm border-white/30 text-white font-medium">
                    {session.user.role.replace("_", " ")}
                  </Badge>
                  {session.user.department && (
                    <Badge className="px-4 py-2 text-sm bg-white/20 backdrop-blur-sm border-white/30 text-white font-medium">
                      {session.user.department}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Stats Cards */}
        {statsLoading ? (
          <DashboardStatsSkeleton />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {statCards.map((card) => (
              <Card 
                key={card.title}
                className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white/80 backdrop-blur-sm"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
                        {card.title}
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {card.value}
                      </p>
                    </div>
                    <div className={`p-4 rounded-xl ${card.bgColor} shadow-md`}>
                      <card.icon className={`h-7 w-7 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Amount Cards */}
        {statsLoading ? (
          <AmountCardsSkeleton />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {amountCards.map((card, index) => (
              <Card 
                key={card.title}
                className={`border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden relative ${
                  index === 0 
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600' 
                    : 'bg-gradient-to-br from-purple-500 to-indigo-600'
                }`}
              >
                <div className="absolute inset-0 bg-[url('/socorro-aerial-view.jpg')] bg-cover bg-center opacity-10"></div>
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white/90 uppercase tracking-wide mb-2">
                        {card.title}
                      </p>
                      <p className="text-3xl font-bold text-white drop-shadow-lg">
                        {card.value}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg">
                      <card.icon className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Recent Vouchers */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">Recent Disbursement Vouchers</CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  Latest vouchers in the system
                </CardDescription>
              </div>
              <Button asChild variant="outline" className="border-blue-200 hover:bg-blue-50">
                <Link href="/disbursements">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <DisbursementListSkeleton />
            ) : recentError ? (
              <div className="text-center py-8 text-red-500">
                Error loading recent vouchers. Please try again.
              </div>
            ) : recentVouchers && recentVouchers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p className="text-lg font-medium">No vouchers found</p>
                <p className="text-sm">
                  {session.user.role === "REQUESTER" && "Create your first disbursement voucher to get started."}
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
              <div className="space-y-4">
                {recentVouchers?.map((voucher) => (
                  <div
                    key={voucher.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md bg-white hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-300 gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <FileText className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                <span className="text-gray-600">Payee:</span> {voucher.payee}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="text-gray-500">Particulars:</span> {voucher.particulars}
                              </p>
                            </div>
                            <div className="text-sm text-gray-500">
                              <span className="text-gray-400">Created by:</span> {voucher.createdBy.name} • {formatDate(voucher.createdAt)}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                              <span className="text-xs font-medium text-amber-700">
                                Processing: {getTotalProcessingTime(voucher.createdAt, voucher.updatedAt)}
                              </span>
                            </div>
                          </div>
                          {/* Current Reviewer Information */}
                          {(() => {
                            const currentReviewer = getCurrentReviewer(voucher, bacRequiredApprovals)
                            return currentReviewer ? (
                              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                  <span className="text-sm font-medium text-blue-800">Current Reviewer:</span>
                                </div>
                                <p className="text-sm text-blue-700 mt-1">
                                  <span className="font-medium">{currentReviewer.displayName}</span> - {currentReviewer.status}
                                </p>
                              </div>
                            ) : null
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end sm:space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(voucher.amount)}
                        </p>
                        <Badge className={getStatusColor(voucher.status)}>
                          {voucher.status}
                        </Badge>
                      </div>
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
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-900">Quick Actions</CardTitle>
              <CardDescription className="text-gray-600">
                Common tasks you can perform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  asChild 
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/50"
                >
                  <Link href="/create">
                    <FileText className="mr-2 h-4 w-4" />
                    Create New Voucher
                  </Link>
                </Button>
                <Button 
                  asChild 
                  variant="outline" 
                  className="w-full sm:w-auto border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                >
                  <Link href="/disbursements?status=DRAFT">
                    View Draft Vouchers
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </MainLayout>
  )
}

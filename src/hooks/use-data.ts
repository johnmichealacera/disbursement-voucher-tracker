/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

// Types
interface Disbursement {
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

interface DashboardStats {
  totalVouchers: number
  pendingVouchers: number
  approvedVouchers: number
  rejectedVouchers: number
  cancelledVouchers: number
  totalAmount: number
  monthlyAmount: number
}

interface Notification {
  id: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
}

// API Functions
const fetchDisbursements = async (params: URLSearchParams): Promise<{
  disbursements: Disbursement[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}> => {
  const response = await fetch(`/api/disbursements?${params}`)
  if (!response.ok) throw new Error('Failed to fetch disbursements')
  return response.json()
}

const fetchRecentDisbursements = async (): Promise<Disbursement[]> => {
  const response = await fetch('/api/disbursements?limit=5')
  if (!response.ok) throw new Error('Failed to fetch recent disbursements')
  const data = await response.json()
  return data.disbursements
}

const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const response = await fetch('/api/disbursements?limit=1000')
  if (!response.ok) throw new Error('Failed to fetch dashboard stats')
  const data = await response.json()
  
  const disbursements = data.disbursements
  const totalVouchers = data.pagination.total
  const pending = disbursements.filter((v: Disbursement) => v.status === "PENDING").length
  const approved = disbursements.filter((v: Disbursement) => v.status === "APPROVED" || v.status === "RELEASED").length
  const rejected = disbursements.filter((v: Disbursement) => v.status === "REJECTED").length
  const cancelled = disbursements.filter((v: Disbursement) => v.status === "CANCELLED").length
  const totalAmount = disbursements.reduce((sum: number, v: Disbursement) => sum + parseFloat(v.amount.toString()), 0)
  
  const currentMonth = new Date().getMonth()
  const monthlyAmount = disbursements
    .filter((v: Disbursement) => new Date(v.createdAt).getMonth() === currentMonth)
    .reduce((sum: number, v: Disbursement) => sum + parseFloat(v.amount.toString()), 0)

  return {
    totalVouchers,
    pendingVouchers: pending,
    approvedVouchers: approved,
    rejectedVouchers: rejected,
    cancelledVouchers: cancelled,
    totalAmount,
    monthlyAmount
  }
}

const fetchNotifications = async (): Promise<{
  notifications: Notification[]
  unreadCount: number
}> => {
  const response = await fetch('/api/notifications')
  if (!response.ok) throw new Error('Failed to fetch notifications')
  return response.json()
}

// Custom Hooks
export function useDisbursements(params: URLSearchParams) {
  return useQuery({
    queryKey: ['disbursements', params.toString()],
    queryFn: () => fetchDisbursements(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!params.toString(),
  })
}

export function useRecentDisbursements() {
  return useQuery({
    queryKey: ['recent-disbursements'],
    queryFn: fetchRecentDisbursements,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  })
}

export function useDisbursement(id: string) {
  return useQuery({
    queryKey: ['disbursement', id],
    queryFn: async () => {
      const response = await fetch(`/api/disbursements/${id}`)
      if (!response.ok) throw new Error('Failed to fetch disbursement')
      return response.json()
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Mutation hooks for updates
export function useUpdateDisbursement() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/disbursements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to update disbursement')
      return response.json()
    },
    onSuccess: (_, { id }) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ['disbursement', id] })
      queryClient.invalidateQueries({ queryKey: ['disbursements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useCreateDisbursement() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/disbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to create disbursement')
      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ['disbursements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

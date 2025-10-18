import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import bcrypt from "bcryptjs"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(num)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

export function getStatusColor(status: string | undefined | null): string {
  if (!status) {
    return 'bg-gray-100 text-gray-800'
  }
  
  switch (status.toLowerCase()) {
    case 'draft':
      return 'bg-gray-100 text-gray-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'validated':
      return 'bg-blue-100 text-blue-800'
    case 'approved':
      return 'bg-green-100 text-green-800'
    case 'released':
      return 'bg-emerald-100 text-emerald-800'
    case 'rejected':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'REQUESTER':
      return 'Requester'
    case 'ACCOUNTING':
      return 'Accounting'
    case 'BUDGET':
      return 'Budget Officer'
    case 'TREASURY':
      return 'Treasury'
    case 'MAYOR':
      return 'Mayor'
    case 'ADMIN':
      return 'Administrator'
    case 'DEPARTMENT_HEAD':
      return 'Department Head'
    case 'FINANCE_HEAD':
      return 'Finance Head'
    case 'GSO':
      return 'General Services Office'
    case 'HR':
      return 'Human Resources'
    case 'BAC':
      return 'Bids and Awards Committee'
    default:
      return role
  }
}

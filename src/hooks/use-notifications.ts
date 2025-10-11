"use client"

import { useState, useEffect, useCallback } from "react"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  disbursementId: string
  disbursementTitle: string
  createdAt: string
  priority: "high" | "medium" | "low"
}

interface NotificationResponse {
  notifications: Notification[]
  unreadCount: number
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/notifications")
      
      if (!response.ok) {
        throw new Error("Failed to fetch notifications")
      }
      
      const data: NotificationResponse = await response.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error fetching notifications:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: fetchNotifications
  }
}

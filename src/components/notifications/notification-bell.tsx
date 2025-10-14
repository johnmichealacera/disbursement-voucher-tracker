"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDateTime } from "@/lib/utils"
import { useNotifications } from "@/hooks/use-notifications"
import { 
  Bell, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText,
  Eye,
  RefreshCw
} from "lucide-react"

export function NotificationBell() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const { notifications, unreadCount, loading, refresh } = useNotifications()

  const handleNotificationClick = (disbursementId: string) => {
    router.push(`/disbursements/${disbursementId}`)
    setIsOpen(false)
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "medium":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "low":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-red-500 bg-red-50"
      case "medium":
        return "border-l-yellow-500 bg-yellow-50"
      case "low":
        return "border-l-green-500 bg-green-50"
      default:
        return "border-l-gray-500 bg-gray-50"
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "approval_needed":
        return "Approval Required"
      case "final_approval_needed":
        return "Final Approval"
      case "ready_for_release":
        return "Ready for Release"
      case "status_update":
        return "Status Update"
      case "admin_overview":
        return "Admin Alert"
      default:
        return "Notification"
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`relative transition-colors ${unreadCount > 0 ? "text-red-600 hover:text-red-700" : ""}`}
        >
          <Bell className={`h-5 w-5 ${unreadCount > 0 ? "animate-pulse" : ""}`} />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-bounce"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-96 max-h-96 overflow-y-auto" 
        align="end" 
        forceMount
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh}
                disabled={loading}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              </Button>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} urgent
                </Badge>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No notifications</p>
              <p className="text-xs text-gray-400">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border-l-4 cursor-pointer hover:bg-gray-100 transition-colors ${getPriorityColor(notification.priority)}`}
                  onClick={() => handleNotificationClick(notification.disbursementId)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2 flex-1">
                      {getPriorityIcon(notification.priority)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                            {getTypeLabel(notification.type)}
                          </p>
                          <span className="text-xs text-gray-400">
                            {formatDateTime(notification.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          {notification.disbursementTitle}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-500">
                            ID: #{notification.disbursementId.slice(-8)}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {notifications.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  router.push("/disbursements")
                  setIsOpen(false)
                }}
              >
                View All Disbursements
              </Button>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

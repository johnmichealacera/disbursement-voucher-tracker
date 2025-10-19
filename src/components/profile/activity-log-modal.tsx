"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Activity, 
  Clock, 
  User, 
  FileText, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  MapPin
} from "lucide-react"
import { formatDateTime } from "@/lib/utils"

interface ActivityLogModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ActivityItem {
  id: string
  action: string
  entityType: string
  entityId: string
  description: string
  timestamp: string
  ipAddress?: string
  userAgent?: string
  oldValues?: any
  newValues?: any
}

export function ActivityLogModal({ isOpen, onClose }: ActivityLogModalProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (isOpen) {
      fetchActivities()
    }
  }, [isOpen])

  const fetchActivities = async () => {
    setLoading(true)
    setError("")
    
    try {
      const response = await fetch("/api/profile/activity")
      
      if (!response.ok) {
        throw new Error("Failed to fetch activity log")
      }
      
      const data = await response.json()
      setActivities(data.activities || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "update":
        return <AlertCircle className="h-4 w-4 text-blue-600" />
      case "delete":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "approve":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "reject":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return "bg-green-100 text-green-800"
      case "update":
        return "bg-blue-100 text-blue-800"
      case "delete":
        return "bg-red-100 text-red-800"
      case "approve":
        return "bg-green-100 text-green-800"
      case "reject":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getEntityIcon = (entityType: string) => {
    switch (entityType.toLowerCase()) {
      case "disbursementvoucher":
        return <FileText className="h-4 w-4 text-blue-600" />
      case "user":
        return <User className="h-4 w-4 text-purple-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const formatActionDescription = (activity: ActivityItem) => {
    const action = activity.action.toLowerCase()
    const entityType = activity.entityType.toLowerCase()
    
    switch (action) {
      case "create":
        return `Created new ${entityType.replace("voucher", "voucher")}`
      case "update":
        return `Updated ${entityType.replace("voucher", "voucher")}`
      case "delete":
        return `Deleted ${entityType.replace("voucher", "voucher")}`
      case "approve":
        return `Approved ${entityType.replace("voucher", "voucher")}`
      case "reject":
        return `Rejected ${entityType.replace("voucher", "voucher")}`
      default:
        return `${activity.action} ${entityType.replace("voucher", "voucher")}`
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Activity Log</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchActivities}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </DialogTitle>
          <DialogDescription>
            View your recent account activity and actions performed in the system.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && activities.length === 0 && (
            <div className="text-center py-8">
              <Activity className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No activity yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Your activity log will appear here as you use the system.
              </p>
            </div>
          )}

          {!loading && !error && activities.length > 0 && (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-shrink-0">
                    {getActionIcon(activity.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getEntityIcon(activity.entityType)}
                        <Badge className={getActionColor(activity.action)}>
                          {activity.action.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>{formatDateTime(activity.timestamp)}</span>
                      </div>
                    </div>
                    
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {formatActionDescription(activity)}
                    </p>
                    
                    {activity.description && (
                      <p className="mt-1 text-sm text-gray-600">
                        {activity.description}
                      </p>
                    )}
                    
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <span>ID:</span>
                        <span className="font-mono">{activity.entityId.slice(-8)}</span>
                      </div>
                      {activity.ipAddress && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3" />
                          <span>{activity.ipAddress}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-500">
            Showing {activities.length} recent activities
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { 
  User, 
  Mail, 
  Building, 
  Shield, 
  Calendar,
  Edit,
  Key,
  Activity
} from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { MainLayout } from "@/components/layout/main-layout"
import { ChangePasswordModal } from "@/components/profile/change-password-modal"
import { EditProfileModal } from "@/components/profile/edit-profile-modal"
import { ActivityLogModal } from "@/components/profile/activity-log-modal"

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Function to refresh the session data
  const refreshProfile = async () => {
    try {
      await update()
      setRefreshKey(prev => prev + 1) // Force re-render
    } catch (error) {
      console.error("Error refreshing profile:", error)
    }
  }

  // Force re-render when session changes
  useEffect(() => {
    // This effect will run when refreshKey changes
  }, [refreshKey])

  if (status === "loading") {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    )
  }

  if (!session?.user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Please log in to view your profile.</p>
        </div>
      </MainLayout>
    )
  }

  const userInitials = session.user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U"

  const getRoleColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-100 text-red-800"
      case "MAYOR":
        return "bg-purple-100 text-purple-800"
      case "FINANCE_HEAD":
        return "bg-blue-100 text-blue-800"
      case "ACCOUNTING":
        return "bg-green-100 text-green-800"
      case "BUDGET":
        return "bg-yellow-100 text-yellow-800"
      case "TREASURY":
        return "bg-indigo-100 text-indigo-800"
      case "DEPARTMENT_HEAD":
        return "bg-orange-100 text-orange-800"
      case "BAC":
        return "bg-pink-100 text-pink-800"
      case "REQUESTER":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getRoleDisplayName = (role: string) => {
    return role.replace("_", " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
            <p className="text-gray-600 mt-1">View your account information and preferences</p>
          </div>
        </div>

        {/* Profile Overview Card */}
        <Card key={`profile-${refreshKey}`}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Profile Overview</span>
            </CardTitle>
            <CardDescription>
              Your basic account information and current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-6">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-2xl">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {session.user.name}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge className={getRoleColor(session.user.role)}>
                      {getRoleDisplayName(session.user.role)}
                    </Badge>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-sm text-gray-500">Active</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{session.user.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Building className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Department</p>
                      <p className="font-medium text-gray-900">
                        {session.user.department || "Not specified"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Account Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Role</span>
                <Badge className={getRoleColor(session.user.role)}>
                  {getRoleDisplayName(session.user.role)}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Account Status</span>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm font-medium text-green-700">Active</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">User ID</span>
                <span className="text-sm font-mono text-gray-700">
                  {session.user.id?.slice(-8) || "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Last Login</span>
                <span className="text-sm text-gray-700">
                  {formatDateTime(new Date())}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Account Created</span>
                <span className="text-sm text-gray-700">
                  {formatDateTime(new Date())}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total Sessions</span>
                <span className="text-sm font-medium text-gray-900">1</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Manage your account settings and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="flex items-center space-x-2 h-auto p-4"
                onClick={() => setShowChangePassword(true)}
              >
                <Key className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Change Password</p>
                  <p className="text-xs text-gray-500">Update your password</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="flex items-center space-x-2 h-auto p-4"
                onClick={() => setShowActivityLog(true)}
              >
                <Activity className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Activity Log</p>
                  <p className="text-xs text-gray-500">View your activity</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <ChangePasswordModal 
        isOpen={showChangePassword} 
        onClose={() => setShowChangePassword(false)} 
      />
      <EditProfileModal 
        isOpen={showEditProfile} 
        onClose={() => setShowEditProfile(false)}
        onProfileUpdated={refreshProfile}
      />
      <ActivityLogModal 
        isOpen={showActivityLog} 
        onClose={() => setShowActivityLog(false)} 
      />
    </MainLayout>
  )
}

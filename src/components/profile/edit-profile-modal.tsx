"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  Mail, 
  Building, 
  CheckCircle, 
  AlertCircle,
  Camera,
  Upload
} from "lucide-react"

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onProfileUpdated?: () => void
}

export function EditProfileModal({ isOpen, onClose, onProfileUpdated }: EditProfileModalProps) {
  const { data: session, update } = useSession()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: ""
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (session?.user) {
      setFormData({
        name: session.user.name || "",
        email: session.user.email || "",
        department: session.user.department || ""
      })
    }
  }, [session])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/profile/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to update profile")
      }

      // Update the session with new data
      await update({
        name: formData.name,
      })

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
        // Call the callback to refresh the parent component
        if (onProfileUpdated) {
          onProfileUpdated()
        }
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const userInitials = formData.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Edit Profile</span>
          </DialogTitle>
          <DialogDescription>
            Update your profile information. Note: Email, department, and role cannot be changed.
          </DialogDescription>
        </DialogHeader>

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Profile updated successfully!
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-xl">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full p-0"
              >
                <Camera className="h-3 w-3" />
              </Button>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{formData.name}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className={getRoleColor(session?.user?.role || "")}>
                  {getRoleDisplayName(session?.user?.role || "")}
                </Badge>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-gray-50 text-gray-500"
                placeholder="Email cannot be changed"
              />
              <p className="text-xs text-gray-500">Email address cannot be modified for security reasons</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                disabled
                className="bg-gray-50 text-gray-500"
                placeholder="Department cannot be changed"
              />
              <p className="text-xs text-gray-500">Department is assigned by administrators and cannot be modified</p>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <Badge className={getRoleColor(session?.user?.role || "")}>
                  {getRoleDisplayName(session?.user?.role || "")}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">Role is assigned by administrators and cannot be changed</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.name.trim()}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

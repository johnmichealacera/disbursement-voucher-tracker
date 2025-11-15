"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MainLayout } from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { formatDate } from "@/lib/utils"
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  UserCheck, 
  UserX,
  Shield,
  Mail,
  Calendar,
  Building
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

interface User {
  id: string
  name: string
  email: string
  role: string
  department?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: {
    createdVouchers: number
    approvals: number
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["REQUESTER", "ACCOUNTING", "BUDGET", "TREASURY", "MAYOR", "ADMIN", "DEPARTMENT_HEAD", "FINANCE_HEAD", "GSO", "HR", "BAC", "SECRETARY"]),
  department: z.string().optional()
}).refine((data) => {
  // Department is required for REQUESTER role
  if (data.role === "REQUESTER") {
    return data.department && data.department.trim().length > 0
  }
  return true
}, {
  message: "Department is required for Requester role",
  path: ["department"]
})

type CreateUserFormData = z.infer<typeof createUserSchema>

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.union([
    z.string().min(6, "Password must be at least 6 characters"),
    z.literal("")
  ]).optional(),
  role: z.enum(["REQUESTER", "ACCOUNTING", "BUDGET", "TREASURY", "MAYOR", "ADMIN", "DEPARTMENT_HEAD", "FINANCE_HEAD", "GSO", "HR", "BAC", "SECRETARY"]).optional(),
  department: z.string().optional(),
  isActive: z.boolean().optional()
}).refine((data) => {
  // Department is required for REQUESTER role
  if (data.role === "REQUESTER") {
    return data.department && data.department.trim().length > 0
  }
  return true
}, {
  message: "Department is required for Requester role",
  path: ["department"]
})

type UpdateUserFormData = z.infer<typeof updateUserSchema>

const roleLabels = {
  REQUESTER: "Requester",
  ACCOUNTING: "Accounting",
  BUDGET: "Budget Officer",
  TREASURY: "Treasury",
  MAYOR: "Mayor",
  ADMIN: "Administrator",
  DEPARTMENT_HEAD: "Department Head",
  FINANCE_HEAD: "Finance Head",
  GSO: "General Services Office",
  HR: "Human Resources",
  BAC: "Bids and Awards Committee",
  SECRETARY: "Secretary"
}

const roleColors = {
  ADMIN: "bg-red-100 text-red-800",
  MAYOR: "bg-purple-100 text-purple-800",
  FINANCE_HEAD: "bg-blue-100 text-blue-800",
  DEPARTMENT_HEAD: "bg-green-100 text-green-800",
  ACCOUNTING: "bg-yellow-100 text-yellow-800",
  BUDGET: "bg-orange-100 text-orange-800",
  TREASURY: "bg-indigo-100 text-indigo-800",
  REQUESTER: "bg-gray-100 text-gray-800",
  GSO: "bg-teal-100 text-teal-800",
  HR: "bg-pink-100 text-pink-800",
  BAC: "bg-violet-100 text-violet-800",
  SECRETARY: "bg-cyan-100 text-cyan-800"
}

export default function AdminUsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [filters, setFilters] = useState({
    role: "all",
    department: "",
    isActive: "all",
    search: ""
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "REQUESTER",
      department: ""
    }
  })

  const editForm = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "REQUESTER",
      department: "",
      isActive: true
    }
  })

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10"
      })

      if (filters.role && filters.role !== "all") params.append("role", filters.role)
      if (filters.department) params.append("department", filters.department)
      if (filters.isActive && filters.isActive !== "all") params.append("isActive", filters.isActive)

      const response = await fetch(`/api/users?${params}`)
      if (response.ok) {
        const data = await response.json()
        let filteredUsers = data.users

        // Apply client-side search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          filteredUsers = filteredUsers.filter((user: User) =>
            user.name.toLowerCase().includes(searchLower) ||
            user.email.toLowerCase().includes(searchLower) ||
            (user.department && user.department.toLowerCase().includes(searchLower))
          )
        }

        setUsers(filteredUsers)
        setPagination(data.pagination)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to fetch users")
      }
    } catch (error) {
      setError("An error occurred while fetching users")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (data: CreateUserFormData) => {
    setIsCreating(true)
    setError("")

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        setIsCreateDialogOpen(false)
        createForm.reset()
        fetchUsers(pagination?.page || 1)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to create user")
      }
    } catch (error) {
      setError("An error occurred while creating the user")
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    editForm.reset({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role as "REQUESTER" | "ACCOUNTING" | "BUDGET" | "TREASURY" | "MAYOR" | "ADMIN" | "DEPARTMENT_HEAD" | "FINANCE_HEAD" | "GSO" | "HR" | "BAC" | "SECRETARY",
      department: user.department || "",
      isActive: user.isActive
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateUser = async (data: UpdateUserFormData) => {
    if (!editingUser) return

    setIsUpdating(true)
    setError("")

    try {
      // Remove password from update if it's empty
      const updateData = { ...data }
      if (!updateData.password || updateData.password.trim() === "") {
        delete updateData.password
      }

      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        setIsEditDialogOpen(false)
        setEditingUser(null)
        editForm.reset()
        fetchUsers(pagination?.page || 1)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to update user")
      }
    } catch (error) {
      setError("An error occurred while updating the user")
    } finally {
      setIsUpdating(false)
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (response.ok) {
        fetchUsers(pagination?.page || 1)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to update user status")
      }
    } catch (error) {
      setError("An error occurred while updating user status")
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [filters.role, filters.department, filters.isActive])

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (filters.search !== undefined) {
        fetchUsers(1)
      }
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [filters.search])

  if (!session) {
    return null
  }

  if (session.user.role !== "ADMIN") {
    return (
      <MainLayout>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertDescription>
              You don&apos;t have permission to access user management.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Users className="mr-3 h-8 w-8" />
              User Management
            </h1>
            <p className="text-gray-600">Manage system users and their permissions</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
        <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to the system with appropriate role and permissions.
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form
                  onSubmit={createForm.handleSubmit(handleCreateUser)}
                  className="space-y-4"
                >
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter email address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password *</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11 border border-gray-200 bg-white shadow-sm hover:border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden p-2 space-y-1">
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <SelectItem
                                key={value}
                                value={value}
                                className="rounded-lg px-3 py-2 data-[highlighted=true]:bg-blue-50 data-[highlighted=true]:text-blue-700"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-medium text-gray-800">{label}</span>
                                  <Badge
                                    variant="secondary"
                                    className={`${roleColors[value as keyof typeof roleColors]} px-2 py-0.5 text-xs font-semibold`}
                                  >
                                    {value}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {createForm.watch("role") === "REQUESTER" && (
                    <FormField
                      control={createForm.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter department" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? "Creating..." : "Create User"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Edit User Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) {
              setEditingUser(null)
              editForm.reset()
            }
          }}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>
                  Update user information and permissions.
                </DialogDescription>
              </DialogHeader>
              <Form {...editForm}>
                <form
                  onSubmit={editForm.handleSubmit(handleUpdateUser)}
                  className="space-y-4"
                >
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter email address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Leave blank to keep current password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11 border border-gray-200 bg-white shadow-sm hover:border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden p-2 space-y-1">
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <SelectItem
                                key={value}
                                value={value}
                                className="rounded-lg px-3 py-2 data-[highlighted=true]:bg-blue-50 data-[highlighted=true]:text-blue-700"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-medium text-gray-800">{label}</span>
                                  <Badge
                                    variant="secondary"
                                    className={`${roleColors[value as keyof typeof roleColors]} px-2 py-0.5 text-xs font-semibold`}
                                  >
                                    {value}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {editForm.watch("role") === "REQUESTER" && (
                    <FormField
                      control={editForm.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter department" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={editForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Account Status</FormLabel>
                          <div className="text-sm text-gray-500">
                            {field.value ? "User can access the system" : "User is deactivated"}
                          </div>
                        </div>
                        <FormControl>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsEditDialogOpen(false)
                        setEditingUser(null)
                        editForm.reset()
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating ? "Updating..." : "Update User"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="mr-2 h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
              <Select
                value={filters.role}
                onValueChange={(value) => setFilters(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Filter by department"
                value={filters.department}
                onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
              />
              <Select
                value={filters.isActive}
                onValueChange={(value) => setFilters(prev => ({ ...prev, isActive: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="true">Active Only</SelectItem>
                  <SelectItem value="false">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({pagination?.total || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-12 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                <p className="mt-1 text-sm text-gray-500">
                {filters.search || (filters.role !== "all") || filters.department || (filters.isActive !== "all")
                  ? "Try adjusting your filters"
                  : "Get started by creating a new user"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-600">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="mr-1 h-3 w-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleColors[user.role as keyof typeof roleColors]}>
                          <Shield className="mr-1 h-3 w-3" />
                          {roleLabels[user.role as keyof typeof roleLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900 flex items-center">
                          <Building className="mr-1 h-3 w-3 text-gray-400" />
                          {user.department || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? (
                            <>
                              <UserCheck className="mr-1 h-3 w-3" />
                              Active
                            </>
                          ) : (
                            <>
                              <UserX className="mr-1 h-3 w-3" />
                              Inactive
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          <div>{user._count.createdVouchers} vouchers</div>
                          <div>{user._count.approvals} approvals</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600 flex items-center">
                          <Calendar className="mr-1 h-3 w-3" />
                          {formatDate(user.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleUserStatus(user.id, user.isActive)}
                            className={user.isActive ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"}
                          >
                            {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                        </div>
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
                onClick={() => fetchUsers(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchUsers(pagination.page + 1)}
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

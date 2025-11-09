"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils"
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Building,
  Tag,
  Boxes,
} from "lucide-react"

interface PayeeOption {
  id: string
  name: string
  address: string
  status: "ACTIVE" | "INACTIVE"
}

interface TagOption {
  id: string
  name: string
  status: "ACTIVE" | "INACTIVE"
}

interface ItemOption {
  id: string
  name: string
  unit: string | null
  defaultUnitPrice: number | null
  status: "ACTIVE" | "INACTIVE"
}

type DirectoryTab = "payees" | "tags" | "items"

const sortByName = <T extends { name: string }>(list: T[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))

const extractErrorMessage = async (response: Response) => {
  try {
    const text = await response.text()
    if (!text) {
      return response.statusText || "An unexpected error occurred"
    }

    const parsed = JSON.parse(text)

    if (Array.isArray(parsed?.details)) {
      return (
        parsed.details
          .map((detail: { message?: string }) => detail?.message)
          .filter(Boolean)
          .join(", ") || parsed.error || response.statusText
      )
    }

    if (Array.isArray(parsed)) {
      return (
        parsed
          .map((detail: { message?: string }) => detail?.message)
          .filter(Boolean)
          .join(", ") || response.statusText
      )
    }

    if (typeof parsed === "object") {
      return (
        parsed.error ||
        parsed.message ||
        response.statusText ||
        "An unexpected error occurred"
      )
    }

    return text
  } catch {
    return response.statusText || "An unexpected error occurred"
  }
}

export default function AdminDirectoriesPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<DirectoryTab>("payees")
  const [payees, setPayees] = useState<PayeeOption[]>([])
  const [tags, setTags] = useState<TagOption[]>([])
  const [items, setItems] = useState<ItemOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [isPayeeDialogOpen, setIsPayeeDialogOpen] = useState(false)
  const [editingPayee, setEditingPayee] = useState<PayeeOption | null>(null)
  const [payeeName, setPayeeName] = useState("")
  const [payeeAddress, setPayeeAddress] = useState("")
  const [payeeDialogError, setPayeeDialogError] = useState("")
  const [isSavingPayee, setIsSavingPayee] = useState(false)
  const [payeeToDelete, setPayeeToDelete] = useState<PayeeOption | null>(null)

  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<TagOption | null>(null)
  const [tagName, setTagName] = useState("")
  const [tagDialogError, setTagDialogError] = useState("")
  const [isSavingTag, setIsSavingTag] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<TagOption | null>(null)

  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemOption | null>(null)
  const [itemName, setItemName] = useState("")
  const [itemUnit, setItemUnit] = useState("")
  const [itemPrice, setItemPrice] = useState<number | "">("")
  const [itemDialogError, setItemDialogError] = useState("")
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<ItemOption | null>(null)

  const loadDirectories = async () => {
    try {
      setLoading(true)
      setError("")

      const requestInit: RequestInit = { cache: "no-store" }

      const [payeeRes, tagRes, itemRes] = await Promise.all([
        fetch("/api/payees?status=ACTIVE", requestInit),
        fetch("/api/tags?status=ACTIVE", requestInit),
        fetch("/api/items?status=ACTIVE", requestInit),
      ])

      if (!payeeRes.ok || !tagRes.ok || !itemRes.ok) {
        const messages = await Promise.all([
          !payeeRes.ok ? extractErrorMessage(payeeRes) : Promise.resolve(""),
          !tagRes.ok ? extractErrorMessage(tagRes) : Promise.resolve(""),
          !itemRes.ok ? extractErrorMessage(itemRes) : Promise.resolve(""),
        ])
        throw new Error(messages.filter(Boolean).join(" • ") || "Failed to load directories")
      }

      const payeeData = await payeeRes.json()
      const tagData = await tagRes.json()
      const itemData = await itemRes.json()

      setPayees(sortByName(payeeData.payees ?? []))
      setTags(sortByName(tagData.tags ?? []))
      setItems(
        sortByName(
          (itemData.items ?? []).map((item: ItemOption) => ({
            ...item,
            defaultUnitPrice:
              typeof item.defaultUnitPrice === "number"
                ? item.defaultUnitPrice
                : item.defaultUnitPrice !== null
                ? Number(item.defaultUnitPrice)
                : null,
          }))
        )
      )
    } catch (err) {
      console.error("Error loading directories:", err)
      setError(err instanceof Error ? err.message : "Failed to load directories")
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadDirectories()
  }, [])

  const refresh = async () => {
    setIsRefreshing(true)
    await loadDirectories()
  }

  const handleSavePayee = async () => {
    if (!payeeName.trim() || !payeeAddress.trim()) {
      setPayeeDialogError("Payee name and address are required")
      return
    }

    setIsSavingPayee(true)
    setPayeeDialogError("")

    try {
      if (editingPayee) {
        const response = await fetch(`/api/payees/${editingPayee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payeeName.trim(),
            address: payeeAddress.trim(),
          }),
        })

        if (!response.ok) {
          const message = await extractErrorMessage(response)
          setPayeeDialogError(message || "Failed to update payee")
          return
        }

        const result = await response.json()
        const updated = result.payee as PayeeOption
        setPayees((prev) =>
          sortByName(prev.map((payee) => (payee.id === updated.id ? updated : payee)))
        )
      } else {
        const response = await fetch("/api/payees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payeeName.trim(),
            address: payeeAddress.trim(),
            status: "ACTIVE",
          }),
        })

        if (!response.ok) {
          const message = await extractErrorMessage(response)
          setPayeeDialogError(message || "Failed to create payee")
          return
        }

        const result = await response.json()
        setPayees((prev) => sortByName([...prev, result.payee as PayeeOption]))
      }

      setIsPayeeDialogOpen(false)
      setEditingPayee(null)
      setPayeeName("")
      setPayeeAddress("")
    } catch (error) {
      console.error("Error saving payee:", error)
      setPayeeDialogError("Failed to save payee")
    } finally {
      setIsSavingPayee(false)
    }
  }

  const handleDeletePayee = async () => {
    if (!payeeToDelete) return
    try {
      const response = await fetch(`/api/payees/${payeeToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok && response.status !== 204) {
        const message = await extractErrorMessage(response)
        setError(message || "Failed to delete payee")
        return
      }

      setPayees((prev) => prev.filter((payee) => payee.id !== payeeToDelete.id))
      setPayeeToDelete(null)
    } catch (error) {
      console.error("Error deleting payee:", error)
      setError("Failed to delete payee")
    }
  }

  const handleSaveTag = async () => {
    if (!tagName.trim()) {
      setTagDialogError("Tag name is required")
      return
    }

    setIsSavingTag(true)
    setTagDialogError("")

    try {
      if (editingTag) {
        const response = await fetch(`/api/tags/${editingTag.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tagName.trim() }),
        })

        if (!response.ok) {
          const message = await extractErrorMessage(response)
          setTagDialogError(message || "Failed to update tag")
          return
        }

        const result = await response.json()
        const updated = result.tag as TagOption
        setTags((prev) =>
          sortByName(prev.map((tag) => (tag.id === updated.id ? updated : tag)))
        )
      } else {
        const response = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tagName.trim(), status: "ACTIVE" }),
        })

        if (!response.ok) {
          const message = await extractErrorMessage(response)
          setTagDialogError(message || "Failed to create tag")
          return
        }

        const result = await response.json()
        setTags((prev) => sortByName([...prev, result.tag as TagOption]))
      }

      setIsTagDialogOpen(false)
      setEditingTag(null)
      setTagName("")
    } catch (error) {
      console.error("Error saving tag:", error)
      setTagDialogError("Failed to save tag")
    } finally {
      setIsSavingTag(false)
    }
  }

  const handleDeleteTag = async () => {
    if (!tagToDelete) return
    try {
      const response = await fetch(`/api/tags/${tagToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok && response.status !== 204) {
        const message = await extractErrorMessage(response)
        setError(message || "Failed to delete tag")
        return
      }

      setTags((prev) => prev.filter((tag) => tag.id !== tagToDelete.id))
      setTagToDelete(null)
    } catch (error) {
      console.error("Error deleting tag:", error)
      setError("Failed to delete tag")
    }
  }

  const handleSaveItem = async () => {
    if (!itemName.trim()) {
      setItemDialogError("Item name is required")
      return
    }

    const parsedPrice =
      itemPrice === ""
        ? undefined
        : typeof itemPrice === "number"
        ? itemPrice
        : Number(itemPrice)

    if (parsedPrice !== undefined && Number.isNaN(parsedPrice)) {
      setItemDialogError("Default unit price must be a valid number")
      return
    }

    setIsSavingItem(true)
    setItemDialogError("")

    try {
      if (editingItem) {
        const response = await fetch(`/api/items/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: itemName.trim(),
            unit: itemUnit.trim() || undefined,
            defaultUnitPrice: parsedPrice,
          }),
        })

        if (!response.ok) {
          const message = await extractErrorMessage(response)
          setItemDialogError(message || "Failed to update item template")
          return
        }

        const result = await response.json()
        const updated = result.item as ItemOption
        setItems((prev) =>
          sortByName(prev.map((item) => (item.id === updated.id ? updated : item)))
        )
      } else {
        const response = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: itemName.trim(),
            unit: itemUnit.trim() || undefined,
            defaultUnitPrice: parsedPrice,
            status: "ACTIVE",
          }),
        })

        if (!response.ok) {
          const message = await extractErrorMessage(response)
          setItemDialogError(message || "Failed to create item template")
          return
        }

        const result = await response.json()
        setItems((prev) => sortByName([...prev, result.item as ItemOption]))
      }

      setIsItemDialogOpen(false)
      setEditingItem(null)
      setItemName("")
      setItemUnit("")
      setItemPrice("")
    } catch (error) {
      console.error("Error saving item:", error)
      setItemDialogError("Failed to save item template")
    } finally {
      setIsSavingItem(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!itemToDelete) return
    try {
      const response = await fetch(`/api/items/${itemToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok && response.status !== 204) {
        const message = await extractErrorMessage(response)
        setError(message || "Failed to delete item template")
        return
      }

      setItems((prev) => prev.filter((item) => item.id !== itemToDelete.id))
      setItemToDelete(null)
    } catch (error) {
      console.error("Error deleting item:", error)
      setError("Failed to delete item template")
    }
  }

  const openCreatePayeeDialog = () => {
    setEditingPayee(null)
    setPayeeName("")
    setPayeeAddress("")
    setPayeeDialogError("")
    setIsPayeeDialogOpen(true)
  }

  const openEditPayeeDialog = (payee: PayeeOption) => {
    setEditingPayee(payee)
    setPayeeName(payee.name)
    setPayeeAddress(payee.address)
    setPayeeDialogError("")
    setIsPayeeDialogOpen(true)
  }

  const openCreateTagDialog = () => {
    setEditingTag(null)
    setTagName("")
    setTagDialogError("")
    setIsTagDialogOpen(true)
  }

  const openEditTagDialog = (tag: TagOption) => {
    setEditingTag(tag)
    setTagName(tag.name)
    setTagDialogError("")
    setIsTagDialogOpen(true)
  }

  const openCreateItemDialog = () => {
    setEditingItem(null)
    setItemName("")
    setItemUnit("")
    setItemPrice("")
    setItemDialogError("")
    setIsItemDialogOpen(true)
  }

  const openEditItemDialog = (item: ItemOption) => {
    setEditingItem(item)
    setItemName(item.name)
    setItemUnit(item.unit ?? "")
    setItemPrice(item.defaultUnitPrice ?? "")
    setItemDialogError("")
    setIsItemDialogOpen(true)
  }

  if (!session) {
    return null
  }

  if (session.user.role !== "ADMIN") {
    return (
      <MainLayout>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertDescription>
              You don&apos;t have permission to access directory management.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    )
  }

  const actionButtons = (onEdit: () => void, onDelete: () => void) => (
    <div className="flex items-center space-x-2">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-red-600 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )

  const isLoadingContent = loading && !isRefreshing

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Settings className="mr-3 h-8 w-8" />
              Directory Management
            </h1>
            <p className="text-gray-600">
              Manage reusable payees, tags, and item templates across the system.
            </p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DirectoryTab)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="payees" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Payees
            </TabsTrigger>
            <TabsTrigger value="tags" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </TabsTrigger>
            <TabsTrigger value="items" className="flex items-center gap-2">
              <Boxes className="h-4 w-4" />
              Item Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payees">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Payees ({payees.length})</CardTitle>
                <Button onClick={openCreatePayeeDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Payee
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingContent ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-12 animate-pulse rounded bg-gray-200" />
                    ))}
                  </div>
                ) : payees.length === 0 ? (
                  <div className="py-16 text-center text-sm text-gray-500">
                    No payees found. Create one to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payees.map((payee) => (
                        <TableRow key={payee.id}>
                          <TableCell className="font-medium text-gray-900">{payee.name}</TableCell>
                          <TableCell className="text-gray-600">{payee.address}</TableCell>
                          <TableCell>{actionButtons(() => openEditPayeeDialog(payee), () => setPayeeToDelete(payee))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tags">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Tags ({tags.length})</CardTitle>
                <Button onClick={openCreateTagDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Tag
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingContent ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-12 animate-pulse rounded bg-gray-200" />
                    ))}
                  </div>
                ) : tags.length === 0 ? (
                  <div className="py-16 text-center text-sm text-gray-500">
                    No tags found. Create one to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tags.map((tag) => (
                        <TableRow key={tag.id}>
                          <TableCell className="font-medium text-gray-900">{tag.name}</TableCell>
                          <TableCell>{actionButtons(() => openEditTagDialog(tag), () => setTagToDelete(tag))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="items">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Item Templates ({items.length})</CardTitle>
                <Button onClick={openCreateItemDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item Template
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingContent ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-12 animate-pulse rounded bg-gray-200" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-16 text-center text-sm text-gray-500">
                    No item templates found. Create one to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Default Price</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-gray-900">{item.name}</TableCell>
                          <TableCell className="text-gray-600">{item.unit || "—"}</TableCell>
                          <TableCell className="text-gray-600">
                            {typeof item.defaultUnitPrice === "number"
                              ? formatCurrency(item.defaultUnitPrice)
                              : "—"}
                          </TableCell>
                          <TableCell>{actionButtons(() => openEditItemDialog(item), () => setItemToDelete(item))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Payee dialog */}
        <Dialog open={isPayeeDialogOpen} onOpenChange={(open) => {
          setIsPayeeDialogOpen(open)
          if (!open) {
            setEditingPayee(null)
            setPayeeName("")
            setPayeeAddress("")
            setPayeeDialogError("")
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPayee ? "Edit Payee" : "Add Payee"}</DialogTitle>
              <DialogDescription>
                {editingPayee ? "Update the selected payee." : "Create a reusable payee entry."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <Input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="Payee name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address *</label>
                <Textarea
                  value={payeeAddress}
                  onChange={(e) => setPayeeAddress(e.target.value)}
                  placeholder="Payee address"
                  rows={3}
                />
              </div>
              {payeeDialogError && (
                <p className="text-sm text-red-600">{payeeDialogError}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPayeeDialogOpen(false)} disabled={isSavingPayee}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSavePayee} disabled={isSavingPayee}>
                {isSavingPayee ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tag dialog */}
        <Dialog open={isTagDialogOpen} onOpenChange={(open) => {
          setIsTagDialogOpen(open)
          if (!open) {
            setEditingTag(null)
            setTagName("")
            setTagDialogError("")
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTag ? "Edit Tag" : "Add Tag"}</DialogTitle>
              <DialogDescription>
                {editingTag ? "Update the selected tag." : "Create a reusable tag."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <Input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="Tag name" />
              </div>
              {tagDialogError && (
                <p className="text-sm text-red-600">{tagDialogError}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTagDialogOpen(false)} disabled={isSavingTag}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveTag} disabled={isSavingTag}>
                {isSavingTag ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Item dialog */}
        <Dialog open={isItemDialogOpen} onOpenChange={(open) => {
          setIsItemDialogOpen(open)
          if (!open) {
            setEditingItem(null)
            setItemName("")
            setItemUnit("")
            setItemPrice("")
            setItemDialogError("")
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Item Template" : "Add Item Template"}</DialogTitle>
              <DialogDescription>
                {editingItem ? "Update the selected item template." : "Create a reusable item template."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Unit</label>
                <Input value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} placeholder="e.g., box, piece" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Default Unit Price</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemPrice === "" ? "" : itemPrice}
                  onChange={(e) => setItemPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Default unit price"
                />
              </div>
              {itemDialogError && (
                <p className="text-sm text-red-600">{itemDialogError}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)} disabled={isSavingItem}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveItem} disabled={isSavingItem}>
                {isSavingItem ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmations */}
        <AlertDialog open={payeeToDelete !== null} onOpenChange={(open) => !open && setPayeeToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete payee</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900">{payeeToDelete?.name}</span>? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeletePayee}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={tagToDelete !== null} onOpenChange={(open) => !open && setTagToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete tag</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900">{tagToDelete?.name}</span>? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteTag}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete item template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900">{itemToDelete?.name}</span>? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteItem}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  )
}
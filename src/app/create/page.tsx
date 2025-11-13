/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { MainLayout } from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { formatCurrency } from "@/lib/utils"
import { Plus, Trash2, Save, Send, X, Clock, Search } from "lucide-react"

// Create conditional schemas based on user role
const createGSOVoucherSchema = z.object({
  payee: z.string().min(1, "Payee is required"),
  address: z.string().min(1, "Address is required"),
  particulars: z.string().min(1, "Particulars is required"),
  tags: z.array(z.string()),
  sourceOffice: z.array(z.string()),
  remarks: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unit: z.string().min(1, "Unit is required"),
    unitPrice: z.number().min(0.01, "Unit price must be greater than 0"),
    totalPrice: z.number().min(0.01, "Total price must be greater than 0")
  })).min(1, "At least one item is required")
})

const createNonGSOVoucherSchema = z.object({
  payee: z.string().min(1, "Payee is required"),
  address: z.string().min(1, "Address is required"),
  particulars: z.string().min(1, "Particulars is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  remarks: z.string().optional()
})

type GSOFormData = z.infer<typeof createGSOVoucherSchema>
type NonGSOFormData = z.infer<typeof createNonGSOVoucherSchema>
type FormData = GSOFormData | NonGSOFormData

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

export default function CreateVoucherPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [offices, setOffices] = useState<string[]>([])
  const [selectedOffice, setSelectedOffice] = useState("")
  const [payees, setPayees] = useState<PayeeOption[]>([])
  const [selectedPayeeId, setSelectedPayeeId] = useState<string>()
  const [isPayeeDialogOpen, setIsPayeeDialogOpen] = useState(false)
  const [newPayeeName, setNewPayeeName] = useState("")
  const [newPayeeAddress, setNewPayeeAddress] = useState("")
  const [payeeError, setPayeeError] = useState("")
  const [isSavingPayee, setIsSavingPayee] = useState(false)
  const [tagsDirectory, setTagsDirectory] = useState<TagOption[]>([])
  const [selectedTagId, setSelectedTagId] = useState<string>()
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [tagError, setTagError] = useState("")
  const [isSavingTag, setIsSavingTag] = useState(false)
  const [itemsDirectory, setItemsDirectory] = useState<ItemOption[]>([])
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false)
  const [newItemName, setNewItemName] = useState("")
  const [newItemUnit, setNewItemUnit] = useState("")
  const [newItemPrice, setNewItemPrice] = useState<number | "">("")
  const [itemError, setItemError] = useState("")
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<(string | undefined)[]>([])
  const [payeeSearchTerm, setPayeeSearchTerm] = useState("")
  const [tagSearchTerm, setTagSearchTerm] = useState("")
  const [itemSearchTerm, setItemSearchTerm] = useState("")

  // Determine if user is GSO
  const isGSOUser = session?.user?.role === "GSO"
  // Use appropriate schema based on user role
  const schema = isGSOUser ? createGSOVoucherSchema : createNonGSOVoucherSchema

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: isGSOUser ? {
      payee: "",
      address: "",
      particulars: "",
      tags: [],
      sourceOffice: [],
      remarks: "",
      items: [
        {
          description: "",
          quantity: 1,
          unit: "",
          unitPrice: 0,
          totalPrice: 0
        }
      ]
    } : {
      payee: "",
      address: "",
      particulars: "",
      amount: 0,
      remarks: ""
    }
  })

  const sortPayeeOptions = useCallback((list: PayeeOption[]) => {
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    )
  }, [])

  const sortTagOptions = useCallback((list: TagOption[]) => {
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    )
  }, [])

  const sortItemOptions = useCallback((list: ItemOption[]) => {
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    )
  }, [])

  const filteredPayees = useMemo(() => {
    const term = payeeSearchTerm.trim().toLowerCase()
    const matches = term
      ? payees.filter((payee) =>
          payee.name.toLowerCase().includes(term) ||
          payee.address.toLowerCase().includes(term)
        )
      : payees

    let options = matches

    if (selectedPayeeId) {
      const selected = payees.find((payee) => payee.id === selectedPayeeId)
      if (selected && !options.some((payee) => payee.id === selectedPayeeId)) {
        options = [selected, ...options]
      }
    }

    return {
      options,
      hasMatches: matches.length > 0
    }
  }, [payees, payeeSearchTerm, selectedPayeeId])

  const filteredTags = useMemo(() => {
    const term = tagSearchTerm.trim().toLowerCase()
    const matches = term
      ? tagsDirectory.filter((tag) =>
          tag.name.toLowerCase().includes(term)
        )
      : tagsDirectory

    let options = matches

    if (selectedTagId) {
      const selected = tagsDirectory.find((tag) => tag.id === selectedTagId)
      if (selected && !options.some((tag) => tag.id === selectedTagId)) {
        options = [selected, ...options]
      }
    }

    return {
      options,
      hasMatches: matches.length > 0
    }
  }, [tagsDirectory, tagSearchTerm, selectedTagId])

  const filteredItems = useMemo(() => {
    const term = itemSearchTerm.trim().toLowerCase()
    const matches = term
      ? itemsDirectory.filter((item) => {
          const unit = item.unit ?? ""
          return (
            item.name.toLowerCase().includes(term) ||
            unit.toLowerCase().includes(term)
          )
        })
      : itemsDirectory

    const selectedItems = selectedItemIds
      .map((id) => itemsDirectory.find((item) => item.id === id))
      .filter((item): item is ItemOption => Boolean(item))

    const combined = [...selectedItems, ...matches].filter(
      (item, index, self) =>
        self.findIndex((other) => other.id === item.id) === index
    )

    return {
      options: combined,
      hasMatches: matches.length > 0
    }
  }, [itemsDirectory, itemSearchTerm, selectedItemIds])

  const loadPayees = useCallback(async () => {
    try {
      const response = await fetch("/api/payees?status=ACTIVE", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to fetch payees")
      }

      const data = await response.json()
      setPayees(sortPayeeOptions(data.payees ?? []))
    } catch (error) {
      console.error("Error fetching payees:", error)
    }
  }, [sortPayeeOptions])

  const loadTags = useCallback(async () => {
    try {
      const response = await fetch("/api/tags?status=ACTIVE", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to fetch tags")
      }

      const data = await response.json()
      setTagsDirectory(sortTagOptions(data.tags ?? []))
    } catch (error) {
      console.error("Error fetching tags:", error)
    }
  }, [sortTagOptions])

  const loadItems = useCallback(async () => {
    try {
      const response = await fetch("/api/items?status=ACTIVE", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to fetch items")
      }

      const data = await response.json()
      setItemsDirectory(sortItemOptions(data.items ?? []))
    } catch (error) {
      console.error("Error fetching items:", error)
    }
  }, [sortItemOptions])

  const applyPayeeSelection = useCallback(
    (payee: PayeeOption | null) => {
      if (payee) {
        setSelectedPayeeId(payee.id)
        form.setValue("payee", payee.name, {
          shouldDirty: true,
          shouldValidate: true
        })
        form.setValue("address", payee.address, {
          shouldDirty: true,
          shouldValidate: true
        })
      } else {
        setSelectedPayeeId(undefined)
        form.setValue("payee", "", {
          shouldDirty: true,
          shouldValidate: true
        })
        form.setValue("address", "", {
          shouldDirty: true,
          shouldValidate: true
        })
      }
    },
    [form]
  )

  const handleClearPayeeSelection = useCallback(() => {
    applyPayeeSelection(null)
  }, [applyPayeeSelection])

const handleCreatePayee = useCallback(async () => {
    if (!newPayeeName.trim() || !newPayeeAddress.trim()) {
      setPayeeError("Payee name and address are required")
      return
    }

    setIsSavingPayee(true)
    setPayeeError("")

    try {
      const response = await fetch("/api/payees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newPayeeName.trim(),
          address: newPayeeAddress.trim(),
          status: "ACTIVE"
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setPayeeError(result.error || "Failed to create payee")
        return
      }

      const createdPayee: PayeeOption = result.payee
      setPayees(prev => sortPayeeOptions([...prev, createdPayee]))
      applyPayeeSelection(createdPayee)

      setNewPayeeName("")
      setNewPayeeAddress("")
      setIsPayeeDialogOpen(false)
    } catch (error) {
      console.error("Error creating payee:", error)
      setPayeeError("Failed to create payee")
    } finally {
      setIsSavingPayee(false)
    }
  }, [
    newPayeeName,
    newPayeeAddress,
    sortPayeeOptions,
    applyPayeeSelection
  ])

const handleAddTagByName = useCallback(
  (tagName: string) => {
    if (!tagName) return
    const currentTags = form.getValues("tags") ?? []
    if (!currentTags.includes(tagName)) {
      form.setValue("tags", [...currentTags, tagName], {
        shouldDirty: true,
        shouldValidate: true
      })
    }
  },
  [form]
)

const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) {
      setTagError("Tag name is required")
      return
    }

    setIsSavingTag(true)
    setTagError("")

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          status: "ACTIVE"
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setTagError(result.error || "Failed to create tag")
        return
      }

      const createdTag: TagOption = result.tag
      setTagsDirectory(prev => sortTagOptions([...prev, createdTag]))
      setNewTagName("")
      setSelectedTagId(createdTag.id)
      handleAddTagByName(createdTag.name)
      setIsTagDialogOpen(false)
    } catch (error) {
      console.error("Error creating tag:", error)
      setTagError("Failed to create tag")
    } finally {
      setIsSavingTag(false)
    }
}, [newTagName, sortTagOptions, handleAddTagByName])

  const handleCreateItem = useCallback(async () => {
    if (!newItemName.trim()) {
      setItemError("Item name is required")
      return
    }

    setIsSavingItem(true)
    setItemError("")

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newItemName.trim(),
          unit: newItemUnit.trim() || undefined,
          defaultUnitPrice:
            newItemPrice === "" ? undefined : Number(newItemPrice),
          status: "ACTIVE"
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setItemError(result.error || "Failed to create item")
        return
      }

      const createdItem: ItemOption = result.item
      setItemsDirectory(prev => sortItemOptions([...prev, createdItem]))

      setNewItemName("")
      setNewItemUnit("")
      setNewItemPrice("")
      setItemError("")
      setIsItemDialogOpen(false)
    } catch (error) {
      console.error("Error creating item:", error)
      setItemError("Failed to create item")
    } finally {
      setIsSavingItem(false)
    }
}, [newItemName, newItemUnit, newItemPrice, sortItemOptions])

  const calculateItemTotal = useCallback((index: number) => {
    const quantity = form.getValues(`items.${index}.quantity`) || 0
    const unitPrice = form.getValues(`items.${index}.unitPrice`) || 0
    const total = quantity * unitPrice
    form.setValue(`items.${index}.totalPrice`, total)
  }, [form])


const handleSelectExistingTag = useCallback(
  (tagId: string | undefined) => {
    if (!tagId) return
    const tag = tagsDirectory.find(entry => entry.id === tagId)
    if (!tag) return
    setSelectedTagId(undefined)
    handleAddTagByName(tag.name)
  },
  [tagsDirectory, handleAddTagByName]
)

const handleRemoveTag = useCallback(
  (tagToRemove: string) => {
    const currentTags = form.getValues("tags") ?? []
    form.setValue(
      "tags",
      currentTags.filter(tag => tag !== tagToRemove),
      { shouldDirty: true, shouldValidate: true }
    )
  },
  [form]
)

const handleSelectItemFromDirectory = useCallback(
  (index: number, itemId: string | undefined) => {
    setSelectedItemIds(prev => {
      const updated = [...prev]
      updated[index] = itemId
      return updated
    })

    if (!itemId) {
      return
    }

    const item = itemsDirectory.find(entry => entry.id === itemId)
    if (!item) {
      return
    }

    form.setValue(`items.${index}.description`, item.name, {
      shouldDirty: true,
      shouldValidate: true
    })

    form.setValue(`items.${index}.unit`, item.unit ?? "", {
      shouldDirty: true,
      shouldValidate: true
    })

    if (typeof item.defaultUnitPrice === "number") {
      form.setValue(`items.${index}.unitPrice`, item.defaultUnitPrice, {
        shouldDirty: true,
        shouldValidate: true
      })
    }

    setTimeout(() => calculateItemTotal(index), 0)
  },
  [itemsDirectory, form, calculateItemTotal]
)

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items" as any
  })

  const watchedItems = form.watch("items" as any)
  const watchedAmount = form.watch("amount" as any)
  
  // Calculate total amount based on user type
  const totalAmount = isGSOUser 
    ? (watchedItems || []).reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0)
    : watchedAmount || 0

  const addItem = () => {
    append({
      description: "",
      quantity: 1,
      unit: "",
      unitPrice: 0,
      totalPrice: 0
    })
    setSelectedItemIds(prev => [...prev, undefined])
  }

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index)
      setSelectedItemIds(prev => prev.filter((_, idx) => idx !== index))
    }
  }

  const addSourceOffice = () => {
    if (selectedOffice) {
      const currentOffices = form.getValues("sourceOffice")
      if (!currentOffices.includes(selectedOffice)) {
        form.setValue("sourceOffice", [...currentOffices, selectedOffice])
      }
      setSelectedOffice("")
    }
  }

  const removeSourceOffice = (officeToRemove: string) => {
    const currentOffices = form.getValues("sourceOffice")
    form.setValue("sourceOffice", currentOffices.filter(office => office !== officeToRemove))
  }

  useEffect(() => {
    setSelectedItemIds(prev => {
      const updated = [...prev]
      if (updated.length < fields.length) {
        return [...updated, ...Array(fields.length - updated.length).fill(undefined)]
      }
      if (updated.length > fields.length) {
        return updated.slice(0, fields.length)
      }
      return updated
    })
  }, [fields.length])

  // Fetch offices on component mount
  useEffect(() => {
    loadPayees()
    loadTags()
    loadItems()

    const fetchOffices = async () => {
      try {
        const response = await fetch("/api/departments")
        if (response.ok) {
          const data = await response.json()
          setOffices(data)
        }
      } catch (error) {
        console.error("Error fetching offices:", error)
      }
    }

    fetchOffices()
  }, [loadPayees, loadTags, loadItems])

  const extractErrorMessage = async (response: Response) => {
    try {
      const text = await response.text()
      if (!text) {
        return response.statusText || "An unexpected error occurred"
      }

      const parsed = JSON.parse(text)

      if (Array.isArray(parsed?.details)) {
        return parsed.details
          .map((detail: { message?: string }) => detail?.message)
          .filter(Boolean)
          .join(", ") || parsed.error || response.statusText
      }

      if (Array.isArray(parsed)) {
        return parsed
          .map((detail: { message?: string }) => detail?.message)
          .filter(Boolean)
          .join(", ") || response.statusText
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

  const onSubmit = async (data: FormData, isDraft = false) => {
    setIsSubmitting(true)
    setError("")

    try {
      // Prepare data based on user type
      const submitData = isGSOUser 
        ? {
            ...data as GSOFormData,
            amount: totalAmount,
            status: "DRAFT"
          }
        : {
            ...data as NonGSOFormData,
            tags: [],
            sourceOffice: [],
            items: [],
            status: "DRAFT"
          }

      // First, create the disbursement as DRAFT
      const createResponse = await fetch("/api/disbursements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      })

      if (!createResponse.ok) {
        const message = await extractErrorMessage(createResponse)
        setError(message || "Failed to create voucher")
        return
      }

      const result = await createResponse.json()

      // If not saving as draft, submit for review
      if (!isDraft) {
        const submitResponse = await fetch(`/api/disbursements/${result.id}/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!submitResponse.ok) {
          const message = await extractErrorMessage(submitResponse)
          setError(message || "Failed to submit voucher for review")
          return
        }
      }

      router.push(`/disbursements/${result.id}`)
    } catch (error) {
      console.error("Error processing voucher:", error)
      setError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while processing the voucher"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!session) {
    return null
  }

  if (!["REQUESTER", "ACCOUNTING", "BUDGET", "TREASURY", "MAYOR", "ADMIN", "DEPARTMENT_HEAD", "FINANCE_HEAD", "GSO", "HR", "BAC"].includes(session.user.role)) {
    return (
      <MainLayout>
        <div className="p-6">
          <Alert>
            <AlertDescription>
              You don&apos;t have permission to create disbursement vouchers.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Disbursement Voucher</h1>
          <p className="text-gray-600">
            Fill out the form below to create a new disbursement request
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => onSubmit(data, false))} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="payee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payee *</FormLabel>
                        <div className="flex flex-col gap-2 md:flex-row md:items-start">
                          <FormControl>
                            <Select
                              value={selectedPayeeId ?? undefined}
                              onValueChange={(value) => {
                                const selected = payees.find(payee => payee.id === value)
                                if (selected) {
                                  applyPayeeSelection(selected)
                                  field.onChange(selected.name)
                                }
                              }}
                              disabled={payees.length === 0}
                              onOpenChange={(open) => {
                                if (!open) {
                                  setPayeeSearchTerm("")
                                }
                              }}
                            >
                              <SelectTrigger className="w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white shadow-sm">
                                <SelectValue
                                  placeholder={
                                    payees.length === 0
                                      ? "No payees available"
                                      : "Select payee"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-md max-h-60 overflow-y-auto">
                                {payees.length === 0 ? (
                                  <SelectItem value="__empty" disabled className="text-sm">
                                    No payees available
                                  </SelectItem>
                                ) : (
                                  <>
                                    <div className="px-3 pb-2 pt-3">
                                      <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                          value={payeeSearchTerm}
                                          onChange={(event) => setPayeeSearchTerm(event.target.value)}
                                          onKeyDown={(event) => event.stopPropagation()}
                                          placeholder="Search payees..."
                                          className="pl-9 h-9 border-gray-200 focus-visible:ring-blue-500"
                                        />
                                      </div>
                                    </div>
                                    {payeeSearchTerm.trim() && !filteredPayees.hasMatches && (
                                      <SelectItem value="__no_payee_match" disabled className="text-sm italic text-gray-500">
                                        No matching payees
                                      </SelectItem>
                                    )}
                                    {filteredPayees.options.map(payee => (
                                      <SelectItem
                                        key={payee.id}
                                        value={payee.id}
                                        className="text-sm md:text-base py-2"
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-medium text-gray-900">
                                            {payee.name}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            {payee.address}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <div className="flex gap-2 flex-wrap md:flex-nowrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPayeeError("")
                                setIsPayeeDialogOpen(true)
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              New Payee
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                handleClearPayeeSelection()
                                field.onChange("")
                              }}
                              disabled={!selectedPayeeId && !field.value}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Clear
                            </Button>
                          </div>
                        </div>
                        {payees.length === 0 && (
                          <p className="text-xs text-gray-500">
                            No payees found. Add a new payee to get started.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Select a payee to auto-fill address"
                            readOnly
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="particulars"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Particulars *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter specific details or particulars"
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tags - Only for GSO users */}
                {isGSOUser && (
                  <div>
                    <FormLabel>Tags</FormLabel>
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start">
                          <Select
                            value={selectedTagId ?? undefined}
                            onValueChange={(value) => handleSelectExistingTag(value)}
                            disabled={tagsDirectory.length === 0}
                            onOpenChange={(open) => {
                              if (!open) {
                                setTagSearchTerm("")
                              }
                            }}
                          >
                            <SelectTrigger className="w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white shadow-sm">
                              <SelectValue
                                placeholder={
                                  tagsDirectory.length === 0
                                    ? "No tags available"
                                    : "Select tag"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-md max-h-60 overflow-y-auto">
                              {tagsDirectory.length === 0 ? (
                                <SelectItem value="__empty" disabled className="text-sm">
                                  No tags available
                                </SelectItem>
                              ) : (
                                <>
                                  <div className="px-3 pb-2 pt-3">
                                    <div className="relative">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                      <Input
                                        value={tagSearchTerm}
                                        onChange={(event) => setTagSearchTerm(event.target.value)}
                                        onKeyDown={(event) => event.stopPropagation()}
                                        placeholder="Search tags..."
                                        className="pl-9 h-9 border-gray-200 focus-visible:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                  {tagSearchTerm.trim() && !filteredTags.hasMatches && (
                                    <SelectItem value="__no_tag_match" disabled className="text-sm italic text-gray-500">
                                      No matching tags
                                    </SelectItem>
                                  )}
                                  {filteredTags.options.map(tag => (
                                    <SelectItem
                                      key={tag.id}
                                      value={tag.id}
                                      className="text-sm md:text-base py-2"
                                    >
                                      <span className="font-medium text-gray-900">
                                        {tag.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2 flex-wrap md:flex-nowrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTagError("")
                                setNewTagName("")
                                setIsTagDialogOpen(true)
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              New Tag
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedTagId(undefined)}
                              disabled={!selectedTagId}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Clear
                            </Button>
                          </div>
                        </div>
                      <div className="flex flex-wrap gap-2">
                        {(form.watch("tags" as any) || []).map((tag: string, index: number) => (
                          <div key={index} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm">
                            {tag}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 hover:bg-blue-200"
                              onClick={() => handleRemoveTag(tag)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Source Office - Only for GSO users */}
                {isGSOUser && (
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700 mb-2 block">
                      Source Office
                    </FormLabel>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Select value={selectedOffice} onValueChange={setSelectedOffice}>
                          <SelectTrigger className="flex-1 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white shadow-sm">
                            <SelectValue placeholder="Select an office to add" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-md max-h-60 overflow-y-auto">
                            {offices.map((office) => (
                              <SelectItem 
                                key={office} 
                                value={office}
                                className="hover:bg-blue-50 focus:bg-blue-50 cursor-pointer py-2 px-3"
                              >
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  <span className="text-gray-700">{office}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          type="button" 
                          onClick={addSourceOffice} 
                          variant="outline" 
                          size="sm"
                          disabled={!selectedOffice}
                          className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700 disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Selected Offices Display */}
                      {(form.watch("sourceOffice" as any) || []).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-600">Selected Offices:</p>
                          <div className="flex flex-wrap gap-2">
                            {(form.watch("sourceOffice" as any) || []).map((office: string, index: number) => (
                              <div key={index} className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-shadow">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span>{office}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 hover:bg-green-200 rounded-full"
                                  onClick={() => removeSourceOffice(office)}
                                >
                                  <X className="h-3 w-3 text-green-600" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Help Text */}
                      <p className="text-xs text-gray-500">
                        Select offices that will be notified about this disbursement request
                      </p>
                    </div>
                  </div>
                )}

                {/* Amount field - Only for non-GSO users */}
                {!isGSOUser && (
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Enter disbursement amount"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional remarks or notes for review"
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Items - Only for GSO users */}
            {isGSOUser && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Items</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Item {index + 1}</h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 md:flex-row md:items-start">
                        <Select
                          value={selectedItemIds[index] ?? undefined}
                          onValueChange={(value) => handleSelectItemFromDirectory(index, value)}
                          disabled={itemsDirectory.length === 0}
                          onOpenChange={(open) => {
                            if (!open) {
                              setItemSearchTerm("")
                            }
                          }}
                        >
                          <SelectTrigger className="w-full md:w-72 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white shadow-sm">
                            <SelectValue
                              placeholder={
                                itemsDirectory.length === 0
                                  ? "No items available"
                                  : "Select item template"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-md max-h-60 overflow-y-auto">
                            {itemsDirectory.length === 0 ? (
                              <SelectItem value="__empty" disabled className="text-sm">
                                No items available
                              </SelectItem>
                            ) : (
                              <>
                                <div className="px-3 pb-2 pt-3">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                      value={itemSearchTerm}
                                      onChange={(event) => setItemSearchTerm(event.target.value)}
                                      onKeyDown={(event) => event.stopPropagation()}
                                      placeholder="Search items..."
                                      className="pl-9 h-9 border-gray-200 focus-visible:ring-blue-500"
                                    />
                                  </div>
                                </div>
                                {itemSearchTerm.trim() && !filteredItems.hasMatches && (
                                  <SelectItem value="__no_item_match" disabled className="text-sm italic text-gray-500">
                                    No matching items
                                  </SelectItem>
                                )}
                                {filteredItems.options.map(item => (
                                  <SelectItem
                                    key={item.id}
                                    value={item.id}
                                    className="text-sm md:text-base py-2"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium text-gray-900">
                                        {item.name}
                                      </span>
                                      {item.unit && (
                                        <span className="text-xs text-gray-500">
                                          Unit: {item.unit}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2 flex-wrap md:flex-nowrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setItemError("")
                              setNewItemName("")
                              setNewItemUnit("")
                              setNewItemPrice("")
                              setIsItemDialogOpen(true)
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            New Item Template
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSelectItemFromDirectory(index, undefined)}
                            disabled={!selectedItemIds[index]}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Clear
                          </Button>
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name={`items.${index}.description` as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description *</FormLabel>
                            <FormControl>
                              <Input placeholder="Item description" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity *</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(parseInt(e.target.value) || 0)
                                    setTimeout(() => calculateItemTotal(index), 0)
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.unit` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., piece, kg, bundle"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.unitPrice` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit Price *</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(parseFloat(e.target.value) || 0)
                                    setTimeout(() => calculateItemTotal(index), 0)
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.totalPrice` as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total Price</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  readOnly
                                  className="bg-gray-50"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Total Amount */}
                  <div className="flex justify-end pt-4 border-t">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(totalAmount)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Total Amount Display - Only for non-GSO users */}
            {!isGSOUser && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-end">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(totalAmount)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onSubmit(form.getValues(), true)}
                disabled={isSubmitting}
              >
                <Save className="mr-2 h-4 w-4" />
                Save as Draft
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg disabled:bg-indigo-300 disabled:text-white disabled:shadow-none px-6 py-3 text-sm md:text-base font-semibold transition-transform duration-150 hover:-translate-y-0.5"
              >
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? "Submitting..." : "Submit for Review"}
              </Button>
            </div>
          </form>
        </Form>

        <Dialog
          open={isPayeeDialogOpen}
          onOpenChange={(open) => {
            setIsPayeeDialogOpen(open)
            if (!open) {
              setNewPayeeName("")
              setNewPayeeAddress("")
              setPayeeError("")
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Payee</DialogTitle>
              <DialogDescription>
                Create a reusable payee entry. Selecting this payee will
                automatically fill in the address for future vouchers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Payee Name *
                </label>
                <Input
                  value={newPayeeName}
                  onChange={(event) => setNewPayeeName(event.target.value)}
                  placeholder="e.g., ABC Trading"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Address *
                </label>
                <Textarea
                  value={newPayeeAddress}
                  onChange={(event) => setNewPayeeAddress(event.target.value)}
                  placeholder="Enter the payee's complete address"
                  rows={3}
                />
              </div>

              {payeeError && (
                <p className="text-sm text-red-600">{payeeError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsPayeeDialogOpen(false)
                  setNewPayeeName("")
                  setNewPayeeAddress("")
                  setPayeeError("")
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreatePayee}
                disabled={isSavingPayee}
              >
                {isSavingPayee ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Payee
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isTagDialogOpen}
          onOpenChange={(open) => {
            setIsTagDialogOpen(open)
            if (!open) {
              setNewTagName("")
              setTagError("")
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Tag</DialogTitle>
              <DialogDescription>
                Create a reusable tag that can be applied to vouchers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tag Name *
                </label>
                <Input
                  value={newTagName}
                  onChange={(event) => setNewTagName(event.target.value)}
                  placeholder="e.g., Procurement"
                />
              </div>
              {tagError && <p className="text-sm text-red-600">{tagError}</p>}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsTagDialogOpen(false)
                  setNewTagName("")
                  setTagError("")
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateTag}
                disabled={isSavingTag}
              >
                {isSavingTag ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Tag
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isItemDialogOpen}
          onOpenChange={(open) => {
            setIsItemDialogOpen(open)
            if (!open) {
              setNewItemName("")
              setNewItemUnit("")
              setNewItemPrice("")
              setItemError("")
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Item Template</DialogTitle>
              <DialogDescription>
                Create a reusable item template with optional default unit and price.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Item Name *
                </label>
                <Input
                  value={newItemName}
                  onChange={(event) => setNewItemName(event.target.value)}
                  placeholder="e.g., Printer Ink"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Unit (Optional)
                </label>
                <Input
                  value={newItemUnit}
                  onChange={(event) => setNewItemUnit(event.target.value)}
                  placeholder="e.g., box, piece"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Default Unit Price (Optional)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItemPrice === "" ? "" : newItemPrice}
                  onChange={(event) =>
                    setNewItemPrice(event.target.value === "" ? "" : Number(event.target.value))
                  }
                  placeholder="Enter default unit price"
                />
              </div>

              {itemError && <p className="text-sm text-red-600">{itemError}</p>}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsItemDialogOpen(false)
                  setNewItemName("")
                  setNewItemUnit("")
                  setNewItemPrice("")
                  setItemError("")
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateItem}
                disabled={isSavingItem}
              >
                {isSavingItem ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Item
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </MainLayout>
  )
}

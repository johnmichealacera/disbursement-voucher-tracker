"use client"

import { useState, useEffect } from "react"
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { formatCurrency } from "@/lib/utils"
import { Plus, Trash2, Save, Send, X } from "lucide-react"

const createVoucherSchema = z.object({
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

type FormData = z.infer<typeof createVoucherSchema>

export default function CreateVoucherPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [offices, setOffices] = useState<string[]>([])
  const [selectedOffice, setSelectedOffice] = useState("")

  const form = useForm<FormData>({
    resolver: zodResolver(createVoucherSchema),
    defaultValues: {
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
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  })

  const watchedItems = form.watch("items")
  const totalAmount = watchedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0)

  const calculateItemTotal = (index: number) => {
    const quantity = form.getValues(`items.${index}.quantity`) || 0
    const unitPrice = form.getValues(`items.${index}.unitPrice`) || 0
    const total = quantity * unitPrice
    form.setValue(`items.${index}.totalPrice`, total)
  }

  const addItem = () => {
    append({
      description: "",
      quantity: 1,
      unit: "",
      unitPrice: 0,
      totalPrice: 0
    })
  }

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const addTag = () => {
    if (tagInput.trim()) {
      const currentTags = form.getValues("tags")
      if (!currentTags.includes(tagInput.trim())) {
        form.setValue("tags", [...currentTags, tagInput.trim()])
      }
      setTagInput("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues("tags")
    form.setValue("tags", currentTags.filter(tag => tag !== tagToRemove))
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

  // Fetch offices on component mount
  useEffect(() => {
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
  }, [])

  const onSubmit = async (data: FormData, isDraft = false) => {
    setIsSubmitting(true)
    setError("")

    try {
      // First, create the disbursement as DRAFT
      const createResponse = await fetch("/api/disbursements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          amount: totalAmount,
          status: "DRAFT"
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        setError(errorData.error || "Failed to create voucher")
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
          const errorData = await submitResponse.json()
          setError(errorData.error || "Failed to submit voucher for review")
          return
        }
      }

      router.push(`/disbursements/${result.id}`)
    } catch {
      setError("An error occurred while processing the voucher")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!session) {
    return null
  }

  if (!["REQUESTER", "ADMIN", "GSO", "HR"].includes(session.user.role)) {
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
                        <FormControl>
                          <Input placeholder="Enter payee name" {...field} />
                        </FormControl>
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
                          <Input placeholder="Enter payee address" {...field} />
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

                {/* Tags */}
                <div>
                  <FormLabel>Tags</FormLabel>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a tag"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      />
                      <Button type="button" onClick={addTag} variant="outline" size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.watch("tags").map((tag, index) => (
                        <div key={index} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm">
                          {tag}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-blue-200"
                            onClick={() => removeTag(tag)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Source Office */}
                <div>
                  <FormLabel>Source Office</FormLabel>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Select value={selectedOffice} onValueChange={setSelectedOffice}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select an office" />
                        </SelectTrigger>
                        <SelectContent>
                          {offices.map((office) => (
                            <SelectItem key={office} value={office}>
                              {office}
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
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.watch("sourceOffice").map((office, index) => (
                        <div key={index} className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm">
                          {office}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-green-200"
                            onClick={() => removeSourceOffice(office)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

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

            {/* Items */}
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

                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
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
                        name={`items.${index}.quantity`}
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
                        name={`items.${index}.unit`}
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
                        name={`items.${index}.unitPrice`}
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
                        name={`items.${index}.totalPrice`}
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
              <Button type="submit" disabled={isSubmitting}>
                <Send className="mr-2 h-4 w-4" />
                Submit for Review
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </MainLayout>
  )
}

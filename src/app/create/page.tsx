/* eslint-disable @typescript-eslint/no-explicit-any */
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

export default function CreateVoucherPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [offices, setOffices] = useState<string[]>([])
  const [selectedOffice, setSelectedOffice] = useState("")

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

                {/* Tags - Only for GSO users */}
                {isGSOUser && (
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
                        {(form.watch("tags" as any) || []).map((tag: string, index: number) => (
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

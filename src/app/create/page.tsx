"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { MainLayout } from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { formatCurrency } from "@/lib/utils"
import { Plus, Trash2, Save, Send, Calculator } from "lucide-react"

const createVoucherSchema = z.object({
  title: z.string().min(1, "Title is required"),
  purpose: z.string().min(1, "Purpose is required"),
  project: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
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

  const form = useForm<FormData>({
    resolver: zodResolver(createVoucherSchema),
    defaultValues: {
      title: "",
      purpose: "",
      project: "",
      items: [
        {
          description: "",
          quantity: 1,
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
      unitPrice: 0,
      totalPrice: 0
    })
  }

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const onSubmit = async (data: FormData, isDraft = false) => {
    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch("/api/disbursements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          amount: totalAmount,
          status: isDraft ? "DRAFT" : "PENDING"
        }),
      })

      if (response.ok) {
        const result = await response.json()
        router.push(`/disbursements/${result.id}`)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to create voucher")
      }
    } catch (error) {
      setError("An error occurred while creating the voucher")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!session) {
    return null
  }

  if (session.user.role !== "REQUESTER" && session.user.role !== "ADMIN") {
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
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter voucher title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the purpose of this disbursement"
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="project"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Associated project name" {...field} />
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

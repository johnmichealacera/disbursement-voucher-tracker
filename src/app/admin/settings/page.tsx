"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Settings, Save, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Resolver, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

interface SystemSetting {
  id: string
  key: string
  value: string
  description?: string
  createdAt: string
  updatedAt: string
}

const settingsFormSchema = z.object({
  bacRequiredApprovals: z.coerce.number().int().min(1, "At least 1 approval is required").max(10, "Maximum 10 approvals allowed")
})

type SettingsFormData = z.infer<typeof settingsFormSchema>

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema) as Resolver<SettingsFormData>,
    defaultValues: {
      bacRequiredApprovals: 3
    }
  })

  useEffect(() => {
    if (status === "loading") return

    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (session?.user?.role !== "ADMIN") {
      router.push("/dashboard")
      return
    }

    fetchSettings()
  }, [session, status, router])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      if (!response.ok) {
        throw new Error("Failed to fetch settings")
      }
      const data = await response.json()
      setSettings(data)

      // Find BAC required approvals setting and set form value
      const bacSetting = data.find((s: SystemSetting) => s.key === "bac_required_approvals")
      if (bacSetting) {
        form.setValue("bacRequiredApprovals", parseInt(bacSetting.value, 10))
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
      setAlert({ type: "error", message: "Failed to load settings" })
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmit = async (data: SettingsFormData) => {
    setIsSaving(true)
    setAlert(null)

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "bac_required_approvals",
          value: data.bacRequiredApprovals.toString(),
          description: "Number of BAC member approvals required for GSO vouchers"
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update settings")
      }

      const updatedSetting = await response.json()
      
      // Update local state
      setSettings((prev) => {
        const existing = prev.find((s) => s.key === updatedSetting.key)
        if (existing) {
          return prev.map((s) => (s.key === updatedSetting.key ? updatedSetting : s))
        }
        return [...prev, updatedSetting]
      })

      setAlert({ 
        type: "success", 
        message: "Settings updated successfully!" 
      })

      // Clear alert after 3 seconds
      setTimeout(() => setAlert(null), 3000)
    } catch (error) {
      console.error("Error updating settings:", error)
      setAlert({ 
        type: "error", 
        message: "Failed to update settings. Please try again." 
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </MainLayout>
    )
  }

  if (session?.user?.role !== "ADMIN") {
    return null
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
            <p className="text-gray-600 mt-1">Configure system-wide settings and preferences</p>
          </div>
        </div>

        {alert && (
          <Alert className={alert.type === "success" ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}>
            {alert.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={alert.type === "success" ? "text-green-800" : "text-red-800"}>
              {alert.message}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-600" />
              <CardTitle>BAC Approval Settings</CardTitle>
            </div>
            <CardDescription>
              Configure the number of BAC member approvals required for GSO vouchers to proceed to the next workflow stage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="bacRequiredApprovals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Required BAC Approvals</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                          className="max-w-xs"
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum number of BAC member approvals needed for GSO vouchers to proceed to Budget review.
                        Current value: {form.watch("bacRequiredApprovals")} approval(s)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-6 border-t-2 border-gray-300 mt-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-6 shadow-md">
                    <div className="flex-1 mb-4 md:mb-0">
                      <p className="text-base font-semibold text-gray-800 mb-1">
                        Ready to save your changes?
                      </p>
                      <p className="text-sm text-gray-600">
                        Click the button to update the BAC approval requirement. Changes will take effect immediately.
                      </p>
                    </div>
                    <Button 
                      type="submit" 
                      disabled={isSaving}
                      size="lg"
                      className="md:ml-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-10 py-7 text-lg shadow-xl hover:shadow-2xl transition-all duration-200 min-w-[200px] w-full md:w-auto transform hover:scale-105 active:scale-95"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-5 w-5" />
                          Save Settings
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}


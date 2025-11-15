import { prisma } from "@/lib/prisma"

/**
 * Get the required number of BAC approvals from system settings
 * Defaults to 3 if not configured
 */
export async function getBacRequiredApprovals(): Promise<number> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: "bac_required_approvals" }
    })

    if (setting && setting.value) {
      const count = parseInt(setting.value, 10)
      return isNaN(count) || count < 1 ? 3 : count
    }

    return 3 // Default fallback
  } catch (error) {
    console.error("Error fetching BAC required approvals:", error)
    return 3 // Default fallback on error
  }
}

/**
 * Get a system setting by key
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key }
    })

    return setting?.value || null
  } catch (error) {
    console.error(`Error fetching system setting ${key}:`, error)
    return null
  }
}


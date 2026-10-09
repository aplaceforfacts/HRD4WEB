import { cookies, headers } from "next/headers"
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth"

/** Server actions re-check admin access; middleware already gates the pages that render them. */
export async function requireAdmin() {
  const cookieStore = await cookies()
  const ok = await isAdminRequest(await headers(), cookieStore.get(ADMIN_COOKIE)?.value)
  if (!ok) throw new Error("Unauthorized")
}

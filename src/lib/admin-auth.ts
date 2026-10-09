/**
 * Admin access: the commissioner signs in once with the admin secret and gets an
 * httpOnly cookie holding a hash of it; cron jobs and scripts send the secret as a
 * Bearer token instead. Works in both the Edge middleware and Node routes.
 */
export const ADMIN_COOKIE = "hrd_admin"

export function adminSecret() {
  return process.env.ADMIN_SECRET ?? process.env.CRON_SECRET ?? null
}

export async function adminCookieValue(secret: string) {
  const data = new TextEncoder().encode(`hrd-admin-v1:${secret}`)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function isAdminRequest(headers: Headers, cookieValue: string | undefined) {
  const secret = adminSecret()
  if (!secret) return false

  const auth = headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (auth && (auth === `Bearer ${secret}` || (cronSecret && auth === `Bearer ${cronSecret}`))) return true

  return Boolean(cookieValue) && cookieValue === (await adminCookieValue(secret))
}

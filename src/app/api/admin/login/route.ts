import { NextResponse } from "next/server"
import { ADMIN_COOKIE, adminCookieValue, adminSecret } from "@/lib/admin-auth"

export async function POST(request: Request) {
  const form = await request.formData()
  const given = String(form.get("secret") ?? "")
  const nextPath = String(form.get("next") ?? "/admin")
  const secret = adminSecret()
  const safeNext = nextPath.startsWith("/admin") ? nextPath : "/admin"

  if (!secret || given !== secret) {
    return NextResponse.redirect(new URL(`/admin/login?error=1&next=${encodeURIComponent(safeNext)}`, request.url), 303)
  }

  const response = NextResponse.redirect(new URL(safeNext, request.url), 303)
  response.cookies.set(ADMIN_COOKIE, await adminCookieValue(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}

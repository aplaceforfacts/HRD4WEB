import { NextResponse, type NextRequest } from "next/server"
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth"

const OPEN_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login"])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (OPEN_ADMIN_PATHS.has(pathname)) return NextResponse.next()

  const allowed = await isAdminRequest(request.headers, request.cookies.get(ADMIN_COOKIE)?.value)
  if (allowed) return NextResponse.next()

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })
  }

  const login = new URL("/admin/login", request.url)
  login.searchParams.set("next", pathname)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/cron/:path*"],
}

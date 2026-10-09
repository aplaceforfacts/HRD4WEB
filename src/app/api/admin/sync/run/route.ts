import { NextRequest, NextResponse } from "next/server"
import { runDailySync } from "@/server/stats/run-daily-sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** The MLB year in progress, by Eastern date (the nightly cron runs at 5 AM ET). */
function currentYear() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(new Date()))
}

// Auth is enforced by src/middleware.ts (admin cookie, or Bearer CRON_SECRET from Vercel Cron).
async function handleSync(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year")
  const year = yearParam ? Number(yearParam) : currentYear()

  if (!Number.isInteger(year)) {
    return NextResponse.json({ ok: false, message: "year must be a four-digit year." }, { status: 400 })
  }

  try {
    const result = await runDailySync(year)
    console.log("SYNC SUCCESS", JSON.stringify(result))
    return NextResponse.json(result)
  } catch (error) {
    console.error("SYNC FAILED", error)
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown sync error" },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return handleSync(request)
}

export async function POST(request: NextRequest) {
  return handleSync(request)
}

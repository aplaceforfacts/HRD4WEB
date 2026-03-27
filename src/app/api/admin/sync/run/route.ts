import { NextRequest, NextResponse } from "next/server"
import { runDailySync } from "@/server/stats/run-daily-sync"

export const dynamic = "force-dynamic"

async function handle(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json(
        { ok: false, message: "CRON_SECRET is not configured." },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      )
    }

    const result = await runDailySync(2026)
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync error"

    return NextResponse.json(
      { ok: false, message },
      { status: 500 }
    )
  }
}

// ✅ Allow BOTH methods
export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
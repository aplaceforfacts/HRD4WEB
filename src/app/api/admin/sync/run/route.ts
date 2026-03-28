import { NextRequest, NextResponse } from "next/server"
import { runDailySync } from "@/server/stats/run-daily-sync"

export const dynamic = "force-dynamic"

async function handleSync(request: NextRequest) {
  console.log("SYNC STARTED", {
    at: new Date().toISOString(),
    method: request.method,
    userAgent: request.headers.get("user-agent"),
  })

  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    console.log("SYNC AUTH CHECK", {
      authHeaderPresent: Boolean(authHeader),
      cronSecretPresent: Boolean(cronSecret),
    })

    if (!cronSecret) {
      console.error("SYNC FAILED: CRON_SECRET missing")
      return NextResponse.json(
        { ok: false, message: "CRON_SECRET is not configured." },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("SYNC FAILED: Unauthorized request")
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      )
    }

    console.log("SYNC RUNNING DAILY SYNC")
    const result = await runDailySync(2026)
    console.log("SYNC SUCCESS", result)

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync error"

    console.error("SYNC FAILED", error)

    return NextResponse.json(
      { ok: false, message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleSync(request)
}

export async function POST(request: NextRequest) {
  return handleSync(request)
}
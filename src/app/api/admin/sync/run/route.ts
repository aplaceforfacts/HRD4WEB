import { NextResponse } from "next/server"
import { runDailySync } from "@/server/stats/run-daily-sync"

export async function POST() {
  try {
    const result = await runDailySync(2026)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}

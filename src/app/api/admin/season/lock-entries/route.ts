import { SeasonStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (!cronSecret) {
    return NextResponse.json({ ok: false, message: "CRON_SECRET is not configured." }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const season = await prisma.season.update({
      where: { year: 2026 },
      data: { entryStatus: SeasonStatus.LOCKED },
      select: { id: true, year: true, entryStatus: true },
    })

    return NextResponse.json({ ok: true, season })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown lock error"
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { batchIngestPayloadSchema, runBatchIngest } from "@/server/admin/batch-ingest"

export const dynamic = "force-dynamic"

function unauthorized() {
  return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (!cronSecret) {
    return NextResponse.json({ ok: false, message: "CRON_SECRET is not configured." }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized()
  }

  try {
    const raw = await request.json()
    const commit = Boolean(raw?.commit)
    const payload = batchIngestPayloadSchema.parse(raw?.payload ?? raw)
    const result = await runBatchIngest(payload, commit)

    return NextResponse.json(result, {
      status: result.invalidEntries.length || result.unresolvedPlayers.length ? 422 : 200,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid batch ingest payload.",
          issues: error.issues,
        },
        { status: 400 },
      )
    }

    const message = error instanceof Error ? error.message : "Unknown batch ingest error"
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}

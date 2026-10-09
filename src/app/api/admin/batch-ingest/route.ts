import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { batchIngestPayloadSchema, runBatchIngest } from "@/server/admin/batch-ingest"

export const dynamic = "force-dynamic"

// Auth is enforced by src/middleware.ts.
export async function POST(request: NextRequest) {
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

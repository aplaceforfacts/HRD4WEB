import { NextResponse } from "next/server"
import { importSnapshotCSV } from "@/server/stats/import-snapshot-csv"

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const result = await importSnapshotCSV(body)

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ message }, { status: 400 })
  }
}

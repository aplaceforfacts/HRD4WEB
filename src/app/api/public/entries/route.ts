import { NextResponse } from "next/server"
import { z } from "zod"
import { createEntry } from "@/server/entries/create-entry"

const entrySchema = z.object({
  seasonId: z.string().min(1),
  ownerName: z.string().min(1),
  ownerEmail: z.string().email(),
  selections: z.array(
    z.object({
      groupCode: z.string().min(1),
      playerId: z.string().min(1),
    }),
  ),
})

export async function POST(request: Request) {
  try {
    const raw = await request.json()
    const body = entrySchema.parse(raw)
    const entry = await createEntry(body)

    return NextResponse.json({
      message: "Entry submitted successfully.",
      entryId: entry.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ message }, { status: 400 })
  }
}

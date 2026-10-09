import { NextResponse } from "next/server"
import { z } from "zod"
import { createEntry } from "@/server/entries/create-entry"

const entrySchema = z.object({
  seasonId: z.string().min(1),
  teamName: z.string().trim().min(1, "Team name is required.").max(60),
  ownerName: z.string().trim().min(1, "Your name is required.").max(80),
  ownerEmail: z.string().trim().email("A valid email is required; it's where the monthly standings workbook goes."),
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
    const parsed = entrySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues.map((issue) => issue.message).join(" ") }, { status: 400 })
    }

    const entry = await createEntry(parsed.data)

    return NextResponse.json({
      message: "Entry submitted successfully.",
      entryId: entry.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ message }, { status: 400 })
  }
}

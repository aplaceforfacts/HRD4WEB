import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyUnsubscribeToken } from "@/server/email/owner-email"

function page(message: string, status = 200) {
  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width"><title>Home Run Derby emails</title><body style="font-family:Arial,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5">${message}</body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ownerId = url.searchParams.get("o") ?? ""
  const seasonId = url.searchParams.get("s") ?? ""
  const token = url.searchParams.get("t") ?? ""

  if (!ownerId || !seasonId || !token || !verifyUnsubscribeToken(ownerId, seasonId, token)) {
    return page("<p>This unsubscribe link isn't valid. Ask your commissioner to remove you from the monthly emails.</p>", 400)
  }

  const updated = await prisma.entry.updateMany({ where: { ownerId, seasonId }, data: { emailOptOut: true } })
  if (updated.count === 0) return page("<p>We couldn't find that subscription.</p>", 404)

  return page(
    "<p>Done. You won't get the monthly standings workbook for the rest of this season. Your teams stay in the league.</p>",
  )
}

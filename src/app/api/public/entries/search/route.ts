import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim() || ""
  const seasonId = searchParams.get("seasonId") || ""

  if (query.length < 2 || !seasonId) return NextResponse.json([])

  const results = await prisma.entry.findMany({
    where: {
      seasonId,
      teamName: {
        contains: query,
        mode: "insensitive",
      },
    },
    select: { id: true, teamName: true },
    orderBy: { teamName: "asc" },
    take: 10,
  })

  return NextResponse.json(
    results.map((entry) => ({
      entryId: entry.id,
      teamName: entry.teamName,
    })),
  )
}

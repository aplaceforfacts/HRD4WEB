import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.toLowerCase() || ""

  if (!query) return NextResponse.json([])

  const results = await prisma.entry.findMany({
    where: {
      owner: {
        name: {
          contains: query,
          mode: "insensitive",
        },
      },
      season: { year: 2026 },
    },
    include: {
      owner: true,
    },
    take: 10,
  })

  return NextResponse.json(
    results.map((entry) => ({
      entryId: entry.id,
      ownerName: entry.owner.name,
    })),
  )
}

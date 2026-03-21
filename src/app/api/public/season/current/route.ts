import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const season = await prisma.season.findUnique({
    where: { year: 2026 },
    include: {
      scoringPeriods: { orderBy: { sortOrder: "asc" } },
    },
  })

  return NextResponse.json(season)
}

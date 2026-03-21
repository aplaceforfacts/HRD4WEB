import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const groups = await prisma.group.findMany({
    where: { season: { year: 2026 } },
    include: {
      seasonPlayers: {
        include: { player: true },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(groups)
}

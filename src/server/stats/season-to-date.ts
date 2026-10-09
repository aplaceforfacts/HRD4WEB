import { prisma } from "@/lib/prisma"

export type SeasonToDateLine = { homeRuns: number; atBats: number; gamesPlayed: number }

/** Each player's season line so far, summed from game logs (games = rows). */
export async function getSeasonToDateLines(seasonYear: number, playerIds: string[]) {
  const rows = await prisma.playerGameLog.groupBy({
    by: ["playerId"],
    where: { seasonYear, playerId: { in: playerIds } },
    _sum: { homeRuns: true, atBats: true },
    _count: { _all: true },
  })

  return new Map<string, SeasonToDateLine>(
    rows.map((row) => [
      row.playerId,
      {
        homeRuns: row._sum.homeRuns ?? 0,
        atBats: row._sum.atBats ?? 0,
        gamesPlayed: row._count._all,
      },
    ]),
  )
}

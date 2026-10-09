import { prisma } from "@/lib/prisma"
import { assignRanksDescending } from "./assign-ranks"

export async function calculateEntryPeriodScores(seasonId: string, scoringPeriodId: string) {
  const [entries, stats] = await Promise.all([
    prisma.entry.findMany({
      where: { seasonId },
      select: { id: true, teamName: true, players: { select: { playerId: true } } },
    }),
    prisma.playerPeriodStat.findMany({
      where: { scoringPeriodId },
      select: { playerId: true, homeRuns: true },
    }),
  ])

  const homeRunsByPlayer = new Map(stats.map((stat) => [stat.playerId, stat.homeRuns]))

  const totals = entries
    .map((entry) => ({
      id: entry.id,
      teamName: entry.teamName,
      score: entry.players.reduce((sum, row) => sum + (homeRunsByPlayer.get(row.playerId) ?? 0), 0),
    }))
    .sort((a, b) => b.score - a.score || a.teamName.localeCompare(b.teamName))

  const ranked = assignRanksDescending(totals)

  await prisma.$transaction(
    ranked.map((row) =>
      prisma.entryPeriodScore.upsert({
        where: {
          entryId_scoringPeriodId: {
            entryId: row.id,
            scoringPeriodId,
          },
        },
        update: {
          seasonId,
          homeRuns: row.score,
          rank: row.rank,
          isTied: row.isTied,
        },
        create: {
          seasonId,
          entryId: row.id,
          scoringPeriodId,
          homeRuns: row.score,
          rank: row.rank,
          isTied: row.isTied,
        },
      }),
    ),
  )
}

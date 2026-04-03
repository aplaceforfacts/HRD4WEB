import { prisma } from "@/lib/prisma"
import { assignRanksDescending } from "@/server/scoring/assign-ranks"

export async function getOddsBoard(periodLabel: string, seasonYear = 2026) {
  const scoringPeriod = await prisma.scoringPeriod.findFirst({
    where: {
      season: { year: seasonYear },
      label: periodLabel,
    },
  })

  if (!scoringPeriod) {
    return null
  }

  const odds = await prisma.entryWinOdds.findMany({
    where: { scoringPeriodId: scoringPeriod.id },
    include: {
      entry: {
        include: {
          owner: true,
          players: {
            include: {
              player: true,
              group: true,
            },
            orderBy: [{ group: { sortOrder: "asc" } }, { slotNumber: "asc" }],
          },
          periodScores: {
            where: { scoringPeriodId: scoringPeriod.id },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ winProbability: "desc" }, { expectedFinalHr: "desc" }],
  })

  const ranked = assignRanksDescending(
    odds.map((row) => ({
      id: row.entry.id,
      ownerName: row.entry.owner.name,
      score: row.winProbability,
      currentHomeRuns: row.entry.periodScores[0]?.homeRuns ?? 0,
      expectedFinalHr: row.expectedFinalHr ?? 0,
      top3Probability: row.top3Probability ?? 0,
      simulatedAt: row.simulatedAt,
      players: row.entry.players.map((entryPlayer) => ({
        playerId: entryPlayer.player.id,
        fullName: entryPlayer.player.fullName,
        groupCode: entryPlayer.group.code,
      })),
    })),
  )

  return {
    period: {
      id: scoringPeriod.id,
      label: scoringPeriod.label,
    },
    rows: ranked,
  }
}

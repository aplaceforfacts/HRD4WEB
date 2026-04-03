import { prisma } from "@/lib/prisma"
import { assignRanksDescending } from "@/server/scoring/assign-ranks"

export async function getStandingsBoard(periodLabel: string, seasonYear = 2026) {
  const scoringPeriod = await prisma.scoringPeriod.findFirst({
    where: {
      season: { year: seasonYear },
      label: periodLabel,
    },
  })

  if (!scoringPeriod) {
    return null
  }

  const scores = await prisma.entryPeriodScore.findMany({
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
          winOdds: {
            where: { scoringPeriodId: scoringPeriod.id },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ homeRuns: "desc" }, { entry: { owner: { name: "asc" } } }],
  })

  const ranked = assignRanksDescending(
    scores.map((row) => ({
      id: row.entry.id,
      ownerName: row.entry.owner.name,
      score: row.homeRuns,
      winProbability: row.entry.winOdds[0]?.winProbability ?? null,
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

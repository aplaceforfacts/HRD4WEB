import { prisma } from "@/lib/prisma"

export async function getOptimalBoard(periodLabel: string, seasonYear = 2026) {
  const scoringPeriod = await prisma.scoringPeriod.findFirst({
    where: {
      season: { year: seasonYear },
      label: periodLabel,
    },
  })

  if (!scoringPeriod) {
    return null
  }

  const lineup = await prisma.optimalLineup.findUnique({
    where: { scoringPeriodId: scoringPeriod.id },
    include: {
      players: {
        include: {
          player: true,
          group: true,
        },
        orderBy: [{ group: { sortOrder: "asc" } }, { slotNumber: "asc" }],
      },
    },
  })

  if (!lineup) {
    return null
  }

  return {
    period: {
      id: scoringPeriod.id,
      label: scoringPeriod.label,
    },
    totalHomeRuns: lineup.totalHomeRuns,
    computedAt: lineup.computedAt,
    rows: lineup.players.map((row) => ({
      id: row.id,
      groupCode: row.group.code,
      playerName: row.player.fullName,
      team: row.player.mlbTeam,
      homeRuns: row.homeRuns,
      rankInGroup: row.rankInGroup,
    })),
  }
}

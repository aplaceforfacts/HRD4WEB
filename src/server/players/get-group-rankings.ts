import { prisma } from "@/lib/prisma"
import { assignRanksDescending } from "@/server/scoring/assign-ranks"

export async function getGroupRankings(groupCode: string, periodLabel: string) {
  const group = await prisma.group.findFirst({
    where: {
      season: { year: 2026 },
      code: groupCode.toUpperCase(),
    },
    include: {
      seasonPlayers: {
        include: {
          player: {
            include: {
              periodStats: {
                where: {
                  scoringPeriod: {
                    label: periodLabel,
                    season: { year: 2026 },
                  },
                },
              },
            },
          },
        },
        orderBy: { displayOrder: "asc" },
      },
    },
  })

  if (!group) return null

  const ranked = assignRanksDescending(
    group.seasonPlayers.map((row) => ({
      id: row.player.id,
      fullName: row.player.fullName,
      mlbTeam: row.player.mlbTeam,
      score: row.player.periodStats[0]?.homeRuns ?? 0,
    })),
  )

  return {
    group: {
      id: group.id,
      code: group.code,
      name: group.name,
    },
    rows: ranked,
  }
}

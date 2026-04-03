import { prisma } from "@/lib/prisma"
import { assignRanksDescending } from "@/server/scoring/assign-ranks"
import { getProjectedHomeRunsForDisplay } from "@/server/forecast/player-projection"

export async function getGroupRankings(groupCode: string, periodLabel: string) {
  const group = await prisma.group.findFirst({
    where: {
      season: { year: 2026 },
      code: groupCode.toUpperCase(),
    },
    include: {
      season: true,
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

  const totalEntries = await prisma.entry.count({
    where: {
      seasonId: group.seasonId,
    },
  })

  const picksByPlayer = await prisma.entryPlayer.groupBy({
    by: ["playerId"],
    where: {
      entry: {
        seasonId: group.seasonId,
      },
    },
    _count: {
      playerId: true,
    },
  })

  const pickCountMap = new Map(
    picksByPlayer.map((p) => [p.playerId, p._count.playerId]),
  )

  const projectedScores = await Promise.all(
    group.seasonPlayers.map(async (row) => {
      const projectedScore = await getProjectedHomeRunsForDisplay({
        seasonId: group.seasonId,
        seasonYear: group.season.year,
        playerId: row.player.id,
        providerPlayerId: row.player.providerPlayerId,
        periodLabel,
      })

      return [row.player.id, projectedScore] as const
    }),
  )

  const projectedScoreMap = new Map(projectedScores)

  const ranked = assignRanksDescending(
    group.seasonPlayers.map((row) => {
      const pickCount = pickCountMap.get(row.player.id) ?? 0
      const pickPercentage = totalEntries > 0 ? pickCount / totalEntries : 0

      return {
        id: row.player.id,
        fullName: row.player.fullName,
        mlbTeam: row.player.mlbTeam,
        score: row.player.periodStats[0]?.homeRuns ?? 0,
        projectedScore: projectedScoreMap.get(row.player.id) ?? null,
        pickPercentage,
      }
    }),
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
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

  // ✅ NEW: total entries
  const totalEntries = await prisma.entry.count({
    where: {
      seasonId: group.seasonId,
    },
  })

  // ✅ NEW: pick counts per player
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
    picksByPlayer.map((p) => [p.playerId, p._count.playerId])
  )

  const ranked = assignRanksDescending(
    group.seasonPlayers.map((row) => {
      const pickCount = pickCountMap.get(row.player.id) ?? 0
      const pickPercentage =
        totalEntries > 0 ? pickCount / totalEntries : 0

      return {
        id: row.player.id,
        fullName: row.player.fullName,
        mlbTeam: row.player.mlbTeam,
        score: row.player.periodStats[0]?.homeRuns ?? 0,
        pickPercentage, // ✅ NEW
      }
    })
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
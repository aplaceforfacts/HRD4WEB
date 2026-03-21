import { prisma } from "@/lib/prisma"

export async function computeOptimalLineup(seasonId: string, scoringPeriodId: string) {
  const groups = await prisma.group.findMany({
    where: { seasonId },
    orderBy: { sortOrder: "asc" },
  })

  const chosen: Array<{
    groupId: string
    playerId: string
    slotNumber: number
    homeRuns: number
    rankInGroup: number | null
  }> = []

  for (const group of groups) {
    const rankedPlayers = await prisma.playerPeriodStat.findMany({
      where: {
        scoringPeriodId,
        groupId: group.id,
      },
      orderBy: [{ homeRuns: "desc" }, { player: { fullName: "asc" } }],
      include: {
        player: true,
      },
    })

    if (group.code === "M") {
      rankedPlayers.slice(0, 4).forEach((row, index) => {
        chosen.push({
          groupId: group.id,
          playerId: row.playerId,
          slotNumber: index + 1,
          homeRuns: row.homeRuns,
          rankInGroup: row.rankInGroup,
        })
      })
    } else {
      const best = rankedPlayers[0]
      if (best) {
        chosen.push({
          groupId: group.id,
          playerId: best.playerId,
          slotNumber: 1,
          homeRuns: best.homeRuns,
          rankInGroup: best.rankInGroup,
        })
      }
    }
  }

  const totalHomeRuns = chosen.reduce((sum, row) => sum + row.homeRuns, 0)

  return prisma.optimalLineup.upsert({
    where: { scoringPeriodId },
    update: {
      totalHomeRuns,
      computedAt: new Date(),
      players: {
        deleteMany: {},
        create: chosen,
      },
    },
    create: {
      seasonId,
      scoringPeriodId,
      totalHomeRuns,
      computedAt: new Date(),
      players: {
        create: chosen,
      },
    },
    include: {
      players: true,
    },
  })
}

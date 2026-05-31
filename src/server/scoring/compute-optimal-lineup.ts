import { prisma } from "@/lib/prisma"

type OptimalLineupSelection = {
  groupId: string
  playerId: string
  slotNumber: number
  homeRuns: number
  rankInGroup: number | null
}

function dedupeOptimalSelections(
  scoringPeriodId: string,
  selections: OptimalLineupSelection[],
) {
  const seenPlayerIds = new Set<string>()
  const deduped: OptimalLineupSelection[] = []

  for (const selection of selections) {
    if (seenPlayerIds.has(selection.playerId)) {
      console.warn("Skipping duplicate optimal lineup player", {
        scoringPeriodId,
        playerId: selection.playerId,
        groupId: selection.groupId,
        slotNumber: selection.slotNumber,
      })
      continue
    }

    seenPlayerIds.add(selection.playerId)
    deduped.push(selection)
  }

  return deduped
}

export async function computeOptimalLineup(seasonId: string, scoringPeriodId: string) {
  const groups = await prisma.group.findMany({
    where: { seasonId },
    orderBy: { sortOrder: "asc" },
  })

  const chosen: OptimalLineupSelection[] = []

  for (const group of groups) {
    const rankedPlayers = await prisma.playerPeriodStat.findMany({
      where: {
        scoringPeriodId,
        groupId: group.id,
      },
      orderBy: [{ homeRuns: "desc" }, { playerId: "asc" }],
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

  const dedupedChosen = dedupeOptimalSelections(scoringPeriodId, chosen)
  const totalHomeRuns = dedupedChosen.reduce((sum, row) => sum + row.homeRuns, 0)

  return prisma.optimalLineup.upsert({
    where: { scoringPeriodId },
    update: {
      totalHomeRuns,
      computedAt: new Date(),
      players: {
        deleteMany: {},
        create: dedupedChosen,
      },
    },
    create: {
      seasonId,
      scoringPeriodId,
      totalHomeRuns,
      computedAt: new Date(),
      players: {
        create: dedupedChosen,
      },
    },
    include: {
      players: true,
    },
  })
}

import { prisma } from "@/lib/prisma"

export async function getEntryDetail(entryId: string, periodLabel = "Season") {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: {
      owner: true,
      season: true,
      players: {
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
          group: true,
        },
        orderBy: [{ group: { sortOrder: "asc" } }, { slotNumber: "asc" }],
      },
      periodScores: {
        where: {
          scoringPeriod: {
            label: periodLabel,
          },
        },
      },
    },
  })

  if (!entry) return null

  const scoringPeriod = await prisma.scoringPeriod.findFirst({
    where: {
      seasonId: entry.seasonId,
      label: periodLabel,
    },
  })

  if (!scoringPeriod) return null

  const allScores = await prisma.entryPeriodScore.findMany({
    where: {
      seasonId: entry.seasonId,
      scoringPeriodId: scoringPeriod.id,
    },
    orderBy: [{ homeRuns: "desc" }, { entry: { owner: { name: "asc" } } }],
    include: {
      entry: {
        include: {
          owner: true,
        },
      },
    },
  })

  const leader = allScores[0] ?? null
  const myScore = entry.periodScores[0] ?? null

  const optimal = await prisma.optimalLineup.findFirst({
    where: {
      seasonId: entry.seasonId,
      scoringPeriodId: scoringPeriod.id,
    },
    include: {
      players: {
        include: {
          group: true,
          player: true,
        },
      },
    },
  })

  const rosterRows = entry.players.map((row) => {
    const stat = row.player.periodStats[0]
    return {
      entryPlayerId: row.id,
      slotNumber: row.slotNumber,
      groupCode: row.group.code,
      groupName: row.group.name,
      playerId: row.player.id,
      playerName: row.player.fullName,
      team: row.player.mlbTeam,
      homeRuns: stat?.homeRuns ?? 0,
      rankInGroup: stat?.rankInGroup ?? null,
      isTied: stat?.isTied ?? false,
    }
  })

  return {
    entry: {
      id: entry.id,
      ownerName: entry.owner.name,
      seasonName: entry.season.name,
    },
    period: scoringPeriod,
    rosterRows,
    myScore,
    leader,
    optimal,
  }
}

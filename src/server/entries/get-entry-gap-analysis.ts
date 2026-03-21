import { prisma } from "@/lib/prisma"

export async function getEntryGapAnalysis(entryId: string, periodLabel = "Season") {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: {
      players: {
        include: {
          group: true,
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

  const optimal = await prisma.optimalLineup.findUnique({
    where: { scoringPeriodId: scoringPeriod.id },
    include: {
      players: {
        include: {
          group: true,
          player: true,
        },
      },
    },
  })

  if (!optimal) return null

  const myRows = entry.players.map((row) => ({
    groupCode: row.group.code,
    slotNumber: row.slotNumber,
    playerName: row.player.fullName,
    homeRuns: row.player.periodStats[0]?.homeRuns ?? 0,
  }))

  const analysisRows = optimal.players.map((optimalRow) => {
    const matchingOwnPick =
      optimalRow.group.code === "M"
        ? myRows.find((row) => row.groupCode === "M" && row.slotNumber === optimalRow.slotNumber)
        : myRows.find((row) => row.groupCode === optimalRow.group.code)

    const ownHomeRuns = matchingOwnPick?.homeRuns ?? 0

    return {
      groupCode: optimalRow.group.code,
      slotNumber: optimalRow.slotNumber,
      optimalPlayerName: optimalRow.player.fullName,
      optimalHomeRuns: optimalRow.homeRuns,
      yourPlayerName: matchingOwnPick?.playerName ?? null,
      yourHomeRuns: ownHomeRuns,
      gap: optimalRow.homeRuns - ownHomeRuns,
    }
  })

  const totalGap = analysisRows.reduce((sum, row) => sum + Math.max(0, row.gap), 0)

  return {
    totalGap,
    rows: analysisRows,
  }
}

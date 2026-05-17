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

  const nonMRows = optimal.players
    .filter((row) => row.group.code !== "M")
    .map((optimalRow) => {
      const matchingOwnPick = myRows.find(
        (row) => row.groupCode === optimalRow.group.code,
      )
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

  const ownGroupMRows = myRows
    .filter((row) => row.groupCode === "M")
    .sort((a, b) => {
      if (b.homeRuns !== a.homeRuns) return b.homeRuns - a.homeRuns
      return a.playerName.localeCompare(b.playerName)
    })

  const optimalGroupMRows = optimal.players
    .filter((row) => row.group.code === "M")
    .sort((a, b) => {
      if (b.homeRuns !== a.homeRuns) return b.homeRuns - a.homeRuns
      return a.player.fullName.localeCompare(b.player.fullName)
    })
    .map((optimalRow, index) => {
      const matchingOwnPick = ownGroupMRows[index]
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

  const analysisRows = [...nonMRows, ...optimalGroupMRows].sort((a, b) => {
    if (a.groupCode === "M" && b.groupCode === "M") {
      return a.slotNumber - b.slotNumber
    }

    if (a.groupCode === "M") return 1
    if (b.groupCode === "M") return -1

    return a.groupCode.localeCompare(b.groupCode)
  })

  const totalGap = analysisRows.reduce((sum, row) => sum + Math.max(0, row.gap), 0)

  return {
    totalGap,
    rows: analysisRows,
  }
}

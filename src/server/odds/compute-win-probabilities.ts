import { prisma } from "@/lib/prisma"

type EntrySimulationRow = {
  entryId: string
  ownerName: string
  currentHr: number
  remainingMeanHr: number
}

function poissonSample(lambda: number) {
  if (lambda <= 0) return 0

  const L = Math.exp(-lambda)
  let k = 0
  let p = 1

  do {
    k += 1
    p *= Math.random()
  } while (p > L)

  return k - 1
}

export async function computeWinProbabilities(periodLabel = "Season", simulations = 2000) {
  const scoringPeriod = await prisma.scoringPeriod.findFirst({
    where: {
      season: { year: 2026 },
      label: periodLabel,
    },
    include: {
      season: true,
    },
  })

  if (!scoringPeriod) throw new Error(`Scoring period not found for ${periodLabel}`)

  const entries = await prisma.entry.findMany({
    where: { seasonId: scoringPeriod.seasonId },
    include: {
      owner: true,
      players: {
        include: {
          player: {
            include: {
              periodStats: {
                where: { scoringPeriodId: scoringPeriod.id },
              },
              projections: {
                where: { seasonYear: 2026 },
                orderBy: { source: "asc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  const rows: EntrySimulationRow[] = entries.map((entry) => {
    const currentHr = entry.players.reduce((sum, row) => sum + (row.player.periodStats[0]?.homeRuns ?? 0), 0)

    const remainingMeanHr = entry.players.reduce((sum, row) => {
      const currentPlayerHr = row.player.periodStats[0]?.homeRuns ?? 0
      const projectedSeasonHr = row.player.projections[0]?.projectedHomeRuns ?? currentPlayerHr
      return sum + Math.max(0, projectedSeasonHr - currentPlayerHr)
    }, 0)

    return {
      entryId: entry.id,
      ownerName: entry.owner.name,
      currentHr,
      remainingMeanHr,
    }
  })

  const wins = new Map<string, number>()
  const top3 = new Map<string, number>()

  for (const row of rows) {
    wins.set(row.entryId, 0)
    top3.set(row.entryId, 0)
  }

  for (let i = 0; i < simulations; i += 1) {
    const simulated = rows.map((row) => ({
      entryId: row.entryId,
      ownerName: row.ownerName,
      finalHr: row.currentHr + poissonSample(row.remainingMeanHr),
    }))

    simulated.sort((a, b) => b.finalHr - a.finalHr)

    const topScore = simulated[0]?.finalHr ?? 0
    const winners = simulated.filter((row) => row.finalHr === topScore)
    const thirdPlaceScore = simulated[Math.min(2, simulated.length - 1)]?.finalHr ?? topScore
    const topThreeRows = simulated.filter((row) => row.finalHr >= thirdPlaceScore)

    for (const winner of winners) {
      wins.set(winner.entryId, (wins.get(winner.entryId) ?? 0) + 1 / winners.length)
    }

    for (const row of topThreeRows) {
      top3.set(row.entryId, (top3.get(row.entryId) ?? 0) + 1)
    }
  }

  const results = rows.map((row) => ({
    entryId: row.entryId,
    ownerName: row.ownerName,
    currentHr: row.currentHr,
    expectedFinalHr: row.currentHr + row.remainingMeanHr,
    winProbability: (wins.get(row.entryId) ?? 0) / simulations,
    top3Probability: (top3.get(row.entryId) ?? 0) / simulations,
  }))

  results.sort((a, b) => b.winProbability - a.winProbability)

  return {
    scoringPeriodId: scoringPeriod.id,
    periodLabel,
    simulations,
    results,
  }
}

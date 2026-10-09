import { prisma } from "@/lib/prisma"
import { isPeriodActive } from "@/lib/periods"
import { ScoringPeriodType } from "@prisma/client"
import { estimateRemainingHomeRuns, FORECAST_MODEL_VERSION } from "@/server/forecast/remaining-home-runs"
import { getSeasonToDateLines } from "@/server/stats/season-to-date"

const TOTAL_SIMULATIONS = 1500
const POISSON_SCALE = 0.8

type ForecastPlayer = {
  playerId: string
  expectedRemainingHomeRuns: number
}

type SimulatedEntry = {
  entryId: string
  currentHomeRuns: number
  players: ForecastPlayer[]
}

type SeasonForOdds = {
  id: string
  year: number
  scoringPeriods: Array<{
    id: string
    label: string
    startDate: Date
    endDate: Date
    periodType: ScoringPeriodType
    sortOrder: number
  }>
}

export async function computeEntryWinOdds(season: SeasonForOdds, asOfDate = new Date()) {
  const targetPeriods = getTargetScoringPeriods(season.scoringPeriods, asOfDate)

  const summaries: Array<{
    scoringPeriodId: string
    label: string
    entriesProcessed: number
    simulations: number
  }> = []

  for (const period of targetPeriods) {
    const simulationInput = await loadSimulationInput({
      season,
      scoringPeriod: period,
      asOfDate,
    })

    if (simulationInput.entries.length === 0) {
      summaries.push({
        scoringPeriodId: period.id,
        label: period.label,
        entriesProcessed: 0,
        simulations: 0,
      })
      continue
    }

    const result = runSimulations(simulationInput.entries, TOTAL_SIMULATIONS)

    await prisma.$transaction(
      result.map((row) =>
        prisma.entryWinOdds.upsert({
          where: {
            entryId_scoringPeriodId: {
              entryId: row.entryId,
              scoringPeriodId: period.id,
            },
          },
          update: {
            seasonId: season.id,
            winProbability: row.winProbability,
            top3Probability: row.top3Probability,
            expectedFinalHr: row.expectedFinalHr,
            simulatedAt: simulationInput.simulatedAt,
          },
          create: {
            seasonId: season.id,
            entryId: row.entryId,
            scoringPeriodId: period.id,
            winProbability: row.winProbability,
            top3Probability: row.top3Probability,
            expectedFinalHr: row.expectedFinalHr,
            simulatedAt: simulationInput.simulatedAt,
          },
        }),
      ),
    )

    await saveForecastSnapshots(season.id, period.id, simulationInput)

    summaries.push({
      scoringPeriodId: period.id,
      label: period.label,
      entriesProcessed: result.length,
      simulations: TOTAL_SIMULATIONS,
    })
  }

  return {
    ok: true,
    seasonYear: season.year,
    periodsProcessed: summaries.length,
    summaries,
  }
}

function getTargetScoringPeriods(scoringPeriods: SeasonForOdds["scoringPeriods"], now: Date) {
  const seasonPeriod = scoringPeriods.find(
    (period) =>
      period.periodType === ScoringPeriodType.SEASON &&
      isPeriodActive(period, now),
  )

  const currentMonthly =
    scoringPeriods.find(
      (period) =>
        period.periodType === ScoringPeriodType.MONTHLY &&
        isPeriodActive(period, now),
    )

  return [seasonPeriod, currentMonthly].filter(Boolean) as SeasonForOdds["scoringPeriods"]
}

type PlayerForecast = {
  playerId: string
  currentHomeRuns: number
  expectedRemainingHomeRuns: number
  availability: string
}

async function loadSimulationInput({
  season,
  scoringPeriod,
  asOfDate,
}: {
  season: SeasonForOdds
  scoringPeriod: SeasonForOdds["scoringPeriods"][number]
  asOfDate: Date
}) {
  const [entries, projections, periodStats] = await Promise.all([
    prisma.entry.findMany({
      where: { seasonId: season.id },
      include: {
        players: {
          include: {
            player: {
              include: {
                historicalStats: {
                  where: { seasonYear: season.year - 1 },
                  take: 1,
                },
              },
            },
          },
        },
        periodScores: {
          where: { scoringPeriodId: scoringPeriod.id },
          take: 1,
        },
      },
    }),
    prisma.playerProjection.findMany({
      where: {
        seasonYear: season.year,
        source: "steamer",
      },
    }),
    prisma.playerPeriodStat.findMany({
      where: { scoringPeriodId: scoringPeriod.id },
      select: { playerId: true, homeRuns: true },
    }),
  ])

  const rosteredIds = [...new Set(entries.flatMap((entry) => entry.players.map((row) => row.playerId)))]
  const seasonLines = await getSeasonToDateLines(season.year, rosteredIds)
  const projectionByPlayerId = new Map(
    projections.map((projection) => [projection.playerId, projection]),
  )
  const periodHomeRuns = new Map(periodStats.map((row) => [row.playerId, row.homeRuns]))
  const simulatedAt = new Date()

  const forecasts = new Map<string, PlayerForecast>()
  const entriesForSimulation: SimulatedEntry[] = []

  for (const entry of entries) {
    const currentHomeRuns = entry.periodScores[0]?.homeRuns ?? 0
    const players: ForecastPlayer[] = []

    for (const entryPlayer of entry.players) {
      if (!forecasts.has(entryPlayer.playerId)) {
        const line = seasonLines.get(entryPlayer.playerId)
        const projection = projectionByPlayerId.get(entryPlayer.playerId)
        const historical = entryPlayer.player.historicalStats[0] ?? null

        const forecast = await estimateRemainingHomeRuns({
          providerPlayerId: entryPlayer.player.providerPlayerId,
          projectionHomeRuns: projection?.projectedHomeRuns ?? null,
          projectionAtBats: projection?.projectedAtBats ?? null,
          snapshotHomeRuns: line?.homeRuns ?? 0,
          snapshotAtBats: line?.atBats ?? 0,
          snapshotGamesPlayed: line?.gamesPlayed ?? 0,
          historicalAtBats: historical?.atBats ?? null,
          historicalGamesPlayed: historical?.gamesPlayed ?? null,
          seasonYear: season.year,
          scoringPeriodType: scoringPeriod.periodType,
          scoringPeriodStart: scoringPeriod.startDate,
          scoringPeriodEnd: scoringPeriod.endDate,
          asOfDate,
        })

        forecasts.set(entryPlayer.playerId, {
          playerId: entryPlayer.playerId,
          currentHomeRuns: periodHomeRuns.get(entryPlayer.playerId) ?? 0,
          expectedRemainingHomeRuns: forecast.expectedRemainingHomeRuns,
          availability: forecast.availability,
        })
      }

      players.push({
        playerId: entryPlayer.playerId,
        expectedRemainingHomeRuns: forecasts.get(entryPlayer.playerId)?.expectedRemainingHomeRuns ?? 0,
      })
    }

    entriesForSimulation.push({
      entryId: entry.id,
      currentHomeRuns,
      players,
    })
  }

  return {
    simulatedAt,
    entries: entriesForSimulation,
    forecasts: [...forecasts.values()],
  }
}

/** Keeps one row per player per period per day; a re-run the same day overwrites it. */
async function saveForecastSnapshots(
  seasonId: string,
  scoringPeriodId: string,
  input: Awaited<ReturnType<typeof loadSimulationInput>>,
) {
  const day = input.simulatedAt.toISOString().slice(0, 10)
  const snapshotDate = new Date(`${day}T00:00:00.000Z`)

  await prisma.$transaction([
    prisma.playerForecastSnapshot.deleteMany({ where: { scoringPeriodId, snapshotDate } }),
    prisma.playerForecastSnapshot.createMany({
      data: input.forecasts.map((row) => ({
        seasonId,
        playerId: row.playerId,
        scoringPeriodId,
        snapshotDate,
        currentHomeRuns: row.currentHomeRuns,
        expectedRemainingHomeRuns: row.expectedRemainingHomeRuns,
        availability: row.availability,
        modelVersion: FORECAST_MODEL_VERSION,
      })),
    }),
  ])
}

function runSimulations(entries: SimulatedEntry[], simulations: number) {
  const wins = new Map<string, number>()
  const top3 = new Map<string, number>()
  const expectedFinalHr = new Map<string, number>()

  for (const entry of entries) {
    wins.set(entry.entryId, 0)
    top3.set(entry.entryId, 0)
    expectedFinalHr.set(
      entry.entryId,
      entry.currentHomeRuns +
        entry.players.reduce(
          (sum, player) => sum + player.expectedRemainingHomeRuns,
          0,
        ),
    )
  }

  for (let sim = 0; sim < simulations; sim += 1) {
    const totals = entries.map((entry) => {
      const simulatedRemaining = entry.players.reduce((sum, player) => {
        const lambda = Math.max(0, player.expectedRemainingHomeRuns * POISSON_SCALE)
        return sum + samplePoisson(lambda)
      }, 0)

      return {
        entryId: entry.entryId,
        totalHomeRuns: entry.currentHomeRuns + simulatedRemaining,
      }
    })

    const winningTotal = Math.max(...totals.map((row) => row.totalHomeRuns))
    const winners = totals.filter((row) => row.totalHomeRuns === winningTotal)

    for (const winner of winners) {
      wins.set(winner.entryId, (wins.get(winner.entryId) ?? 0) + 1 / winners.length)
    }

    const rankByEntryId = buildCompetitionRanks(totals)

    for (const row of totals) {
      const rank = rankByEntryId.get(row.entryId) ?? Number.POSITIVE_INFINITY
      if (rank <= 3) {
        top3.set(row.entryId, (top3.get(row.entryId) ?? 0) + 1)
      }
    }
  }

  return entries
    .map((entry) => ({
      entryId: entry.entryId,
      winProbability: (wins.get(entry.entryId) ?? 0) / simulations,
      top3Probability: Math.min(1, (top3.get(entry.entryId) ?? 0) / simulations),
      expectedFinalHr: expectedFinalHr.get(entry.entryId) ?? entry.currentHomeRuns,
    }))
    .sort((a, b) => b.winProbability - a.winProbability)
}

function buildCompetitionRanks(
  totals: Array<{ entryId: string; totalHomeRuns: number }>,
) {
  const sorted = [...totals].sort((a, b) => b.totalHomeRuns - a.totalHomeRuns)
  const rankByEntryId = new Map<string, number>()

  let currentRank = 1

  for (let index = 0; index < sorted.length; ) {
    const tiedScore = sorted[index].totalHomeRuns
    const tiedRows: Array<{ entryId: string; totalHomeRuns: number }> = []

    while (index < sorted.length && sorted[index].totalHomeRuns === tiedScore) {
      tiedRows.push(sorted[index])
      index += 1
    }

    for (const row of tiedRows) {
      rankByEntryId.set(row.entryId, currentRank)
    }

    currentRank += tiedRows.length
  }

  return rankByEntryId
}

function samplePoisson(lambda: number) {
  if (lambda <= 0) {
    return 0
  }

  if (lambda > 50) {
    return Math.max(0, Math.round(sampleNormal(lambda, Math.sqrt(lambda))))
  }

  const threshold = Math.exp(-lambda)
  let product = 1
  let count = 0

  while (product > threshold) {
    count += 1
    product *= Math.random()
  }

  return count - 1
}

function sampleNormal(mean: number, stdDev: number) {
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 =
    Math.sqrt(-2 * Math.log(Math.max(u1, Number.EPSILON))) *
    Math.cos(2 * Math.PI * u2)

  return mean + z0 * stdDev
}


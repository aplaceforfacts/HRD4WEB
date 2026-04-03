import { prisma } from "@/lib/prisma"
import { ScoringPeriodType } from "@prisma/client"
import {
  getPlayerSeasonSnapshot,
  getTeamGamesScheduledBetween,
} from "@/server/stats/mlb-stats-api"

const TOTAL_SIMULATIONS = 1500
const POISSON_SCALE = 0.8
const DEFAULT_AB_PER_GAME = 4
const ACTIVE_STATUS = "ACTIVE"
const IL_10_STATUS = "IL_10"
const IL_60_STATUS = "IL_60"
const MINORS_STATUS = "MINORS"

type ForecastPlayer = {
  playerId: string
  expectedRemainingHomeRuns: number
}

type SimulatedEntry = {
  entryId: string
  currentHomeRuns: number
  players: ForecastPlayer[]
}

export async function computeEntryWinOdds(seasonYear = 2026) {
  const season = await prisma.season.findUnique({
    where: { year: seasonYear },
    include: {
      scoringPeriods: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!season) {
    throw new Error(`Season ${seasonYear} not found.`)
  }

  const targetPeriods = getTargetScoringPeriods(season.scoringPeriods)
  const summaries: Array<{
    scoringPeriodId: string
    label: string
    entriesProcessed: number
    simulations: number
  }> = []

  for (const period of targetPeriods) {
    const simulationInput = await loadSimulationInput({
      seasonId: season.id,
      seasonYear,
      scoringPeriodId: period.id,
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

    summaries.push({
      scoringPeriodId: period.id,
      label: period.label,
      entriesProcessed: result.length,
      simulations: TOTAL_SIMULATIONS,
    })
  }

  return {
    ok: true,
    seasonYear,
    periodsProcessed: summaries.length,
    summaries,
  }
}

function getTargetScoringPeriods(
  scoringPeriods: Array<{
    id: string
    label: string
    startDate: Date
    endDate: Date
    periodType: ScoringPeriodType
    sortOrder: number
  }>,
) {
  const now = new Date()

  const seasonPeriod = scoringPeriods.find(
    (period) => period.periodType === ScoringPeriodType.SEASON,
  )

  const currentMonthly =
    scoringPeriods.find(
      (period) =>
        period.periodType === ScoringPeriodType.MONTHLY &&
        now >= period.startDate &&
        now <= period.endDate,
    ) ??
    scoringPeriods
      .filter(
        (period) =>
          period.periodType === ScoringPeriodType.MONTHLY &&
          now >= period.startDate,
      )
      .sort((a, b) => b.sortOrder - a.sortOrder)[0]

  return [seasonPeriod, currentMonthly].filter(Boolean) as Array<{
    id: string
    label: string
    startDate: Date
    endDate: Date
    periodType: ScoringPeriodType
    sortOrder: number
  }>
}

async function loadSimulationInput({
  seasonId,
  seasonYear,
  scoringPeriodId,
}: {
  seasonId: string
  seasonYear: number
  scoringPeriodId: string
}) {
  const scoringPeriod = await prisma.scoringPeriod.findUnique({
    where: { id: scoringPeriodId },
  })

  if (!scoringPeriod) {
    throw new Error(`Scoring period ${scoringPeriodId} not found.`)
  }

  const [entries, latestSnapshots, projections] = await Promise.all([
    prisma.entry.findMany({
      where: { seasonId },
      include: {
        owner: true,
        players: {
          include: {
            player: {
              include: {
                historicalStats: {
                  where: { seasonYear: seasonYear - 1 },
                  take: 1,
                },
              },
            },
            group: true,
          },
          orderBy: [{ group: { sortOrder: "asc" } }, { slotNumber: "asc" }],
        },
        periodScores: {
          where: { scoringPeriodId },
          take: 1,
        },
      },
      orderBy: {
        owner: { name: "asc" },
      },
    }),
    prisma.playerStatSnapshot.findMany({
      where: { seasonId },
      orderBy: [{ playerId: "asc" }, { snapshotDate: "desc" }],
      distinct: ["playerId"],
    }),
    prisma.playerProjection.findMany({
      where: {
        seasonYear,
        source: "steamer",
      },
    }),
  ])

  const snapshotByPlayerId = new Map(
    latestSnapshots.map((snapshot) => [snapshot.playerId, snapshot]),
  )
  const projectionByPlayerId = new Map(
    projections.map((projection) => [projection.playerId, projection]),
  )
  const simulatedAt = new Date()

  const playerForecastCache = new Map<string, number>()
  const entriesForSimulation: SimulatedEntry[] = []

  for (const entry of entries) {
    const currentHomeRuns = entry.periodScores[0]?.homeRuns ?? 0
    const players: ForecastPlayer[] = []

    for (const entryPlayer of entry.players) {
      const cacheKey = `${entryPlayer.playerId}:${scoringPeriod.id}`

      if (!playerForecastCache.has(cacheKey)) {
        const snapshot = snapshotByPlayerId.get(entryPlayer.playerId)
        const projection = projectionByPlayerId.get(entryPlayer.playerId)
        const historical = entryPlayer.player.historicalStats[0] ?? null

        const expectedRemainingHomeRuns = await estimateRemainingHomeRuns({
          providerPlayerId: entryPlayer.player.providerPlayerId,
          projectionHomeRuns: projection?.projectedHomeRuns ?? null,
          projectionAtBats: projection?.projectedAtBats ?? null,
          snapshotHomeRuns: snapshot?.homeRuns ?? 0,
          snapshotAtBats: snapshot?.atBats ?? 0,
          snapshotGamesPlayed: snapshot?.gamesPlayed ?? 0,
          historicalAtBats: historical?.atBats ?? null,
          historicalGamesPlayed: historical?.gamesPlayed ?? null,
          scoringPeriodType: scoringPeriod.periodType,
          scoringPeriodStart: scoringPeriod.startDate,
          scoringPeriodEnd: scoringPeriod.endDate,
          asOfDate: simulatedAt,
        })

        playerForecastCache.set(cacheKey, expectedRemainingHomeRuns)
      }

      players.push({
        playerId: entryPlayer.playerId,
        expectedRemainingHomeRuns: playerForecastCache.get(cacheKey) ?? 0,
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
  }
}

async function estimateRemainingHomeRuns({
  providerPlayerId,
  projectionHomeRuns,
  projectionAtBats,
  snapshotHomeRuns,
  snapshotAtBats,
  snapshotGamesPlayed,
  historicalAtBats,
  historicalGamesPlayed,
  scoringPeriodType,
  scoringPeriodStart,
  scoringPeriodEnd,
  asOfDate,
}: {
  providerPlayerId: string | null
  projectionHomeRuns: number | null
  projectionAtBats: number | null
  snapshotHomeRuns: number
  snapshotAtBats: number
  snapshotGamesPlayed: number
  historicalAtBats: number | null
  historicalGamesPlayed: number | null
  scoringPeriodType: ScoringPeriodType
  scoringPeriodStart: Date
  scoringPeriodEnd: Date
  asOfDate: Date
}) {
  if (!providerPlayerId) {
    return 0
  }

  const liveSnapshot = await getPlayerSeasonSnapshot(Number(providerPlayerId))
  const availabilityStatus = classifyPlayerStatus(
    liveSnapshot.statusCode,
    liveSnapshot.statusDescription,
  )

  if (availabilityStatus === IL_60_STATUS || availabilityStatus === MINORS_STATUS) {
    return 0
  }

  const abPerGame =
    safeDivide(snapshotAtBats, snapshotGamesPlayed) ??
    safeDivide(historicalAtBats, historicalGamesPlayed) ??
    DEFAULT_AB_PER_GAME

  const projectedTotalGames =
    projectionAtBats && projectionAtBats > 0
      ? Math.max(0, projectionAtBats / abPerGame)
      : 162

  const projectedRemainingGames = Math.max(
    0,
    projectedTotalGames - snapshotGamesPlayed,
  )

  let teamGamesRemaining = 0

  if (liveSnapshot.teamId) {
    const startDate = startOfDay(asOfDate)
    const periodStart =
      scoringPeriodType === ScoringPeriodType.SEASON
        ? startDate
        : maxDate(startDate, scoringPeriodStart)

    teamGamesRemaining = await getTeamGamesScheduledBetween(
      liveSnapshot.teamId,
      periodStart,
      scoringPeriodEnd,
    )
  }

  let remainingGames = Math.min(projectedRemainingGames, teamGamesRemaining)

  if (availabilityStatus === IL_10_STATUS) {
    remainingGames = Math.max(0, remainingGames - 10)
  }

  const projectionWeight = getCurrentProjectionWeight(asOfDate)
  const projectedHrPerGame =
    projectionHomeRuns && projectedTotalGames > 0
      ? projectionHomeRuns / projectedTotalGames
      : 0
  const actualHrPerGame =
    snapshotGamesPlayed > 0 ? snapshotHomeRuns / snapshotGamesPlayed : 0

  const blendedHrPerGame =
    projectedHrPerGame * projectionWeight +
    actualHrPerGame * (1 - projectionWeight)

  return Math.max(0, blendedHrPerGame * remainingGames)
}

function getCurrentProjectionWeight(asOfDate: Date) {
  const month = asOfDate.getMonth() + 1

  if (month <= 4) {
    return 1
  }

  if (month === 5) {
    return 0.75
  }

  if (month === 6) {
    return 0.5
  }

  if (month === 7) {
    return 0.25
  }

  return 0
}

function classifyPlayerStatus(
  statusCode: string | null,
  statusDescription: string | null,
) {
  const merged = `${statusCode ?? ""} ${statusDescription ?? ""}`.toLowerCase()

  if (merged.includes("60")) {
    return IL_60_STATUS
  }

  if (merged.includes("10") || merged.includes("15") || merged.includes("injured")) {
    return IL_10_STATUS
  }

  if (merged.includes("minors") || merged.includes("optioned")) {
    return MINORS_STATUS
  }

  return ACTIVE_STATUS
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

function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
) {
  if (!numerator || !denominator || denominator <= 0) {
    return null
  }

  return numerator / denominator
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function maxDate(a: Date, b: Date) {
  return a > b ? a : b
}
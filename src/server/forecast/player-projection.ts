import { prisma } from "@/lib/prisma"
import { ScoringPeriodType } from "@prisma/client"
import {
  getPlayerSeasonSnapshot,
  getTeamGamesScheduledBetween,
} from "@/server/stats/mlb-stats-api"

const DEFAULT_AB_PER_GAME = 4
const ACTIVE_STATUS = "ACTIVE"
const IL_10_STATUS = "IL_10"
const IL_60_STATUS = "IL_60"
const MINORS_STATUS = "MINORS"
const SUSPENDED_STATUS = "SUSPENDED"

export async function getProjectedHomeRunsForDisplay({
  seasonId,
  seasonYear,
  playerId,
  providerPlayerId,
  periodLabel,
  asOfDate = new Date(),
}: {
  seasonId: string
  seasonYear: number
  playerId: string
  providerPlayerId: string | null
  periodLabel: string
  asOfDate?: Date
}) {
  const scoringPeriods = await prisma.scoringPeriod.findMany({
    where: { seasonId },
    orderBy: { sortOrder: "asc" },
  })

  const selectedPeriod = scoringPeriods.find((period) => period.label === periodLabel)

  if (!selectedPeriod) {
    return null
  }

  const activeMonthlyPeriod =
    scoringPeriods.find(
      (period) =>
        period.periodType === ScoringPeriodType.MONTHLY &&
        asOfDate >= period.startDate &&
        asOfDate < period.endDate,
    ) ??
    scoringPeriods
      .filter(
        (period) =>
          period.periodType === ScoringPeriodType.MONTHLY &&
          asOfDate >= period.startDate,
      )
      .sort((a, b) => b.sortOrder - a.sortOrder)[0] ??
    null

  const shouldProject =
    selectedPeriod.periodType === ScoringPeriodType.SEASON ||
    (!!activeMonthlyPeriod && selectedPeriod.id === activeMonthlyPeriod.id)

  if (!shouldProject) {
    return null
  }

  const [periodStat, latestSnapshot, projection, historical] = await Promise.all([
    prisma.playerPeriodStat.findUnique({
      where: {
        playerId_scoringPeriodId: {
          playerId,
          scoringPeriodId: selectedPeriod.id,
        },
      },
    }),
    prisma.playerStatSnapshot.findFirst({
      where: { seasonId, playerId },
      orderBy: { snapshotDate: "desc" },
    }),
    prisma.playerProjection.findFirst({
      where: {
        playerId,
        seasonYear,
        source: "steamer",
      },
    }),
    prisma.historicalPlayerStat.findFirst({
      where: {
        playerId,
        seasonYear: seasonYear - 1,
      },
    }),
  ])

  const currentHomeRuns = periodStat?.homeRuns ?? 0

  const expectedRemainingHomeRuns = await estimateRemainingHomeRuns({
    providerPlayerId,
    projectionHomeRuns: projection?.projectedHomeRuns ?? null,
    projectionAtBats: projection?.projectedAtBats ?? null,
    snapshotHomeRuns: latestSnapshot?.homeRuns ?? 0,
    snapshotAtBats: latestSnapshot?.atBats ?? 0,
    snapshotGamesPlayed: latestSnapshot?.gamesPlayed ?? 0,
    historicalAtBats: historical?.atBats ?? null,
    historicalGamesPlayed: historical?.gamesPlayed ?? null,
    scoringPeriodType: selectedPeriod.periodType,
    scoringPeriodStart: selectedPeriod.startDate,
    scoringPeriodEnd: selectedPeriod.endDate,
    asOfDate,
  })

  return currentHomeRuns + expectedRemainingHomeRuns
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

  if (
    availabilityStatus === IL_60_STATUS ||
    availabilityStatus === MINORS_STATUS ||
    availabilityStatus === SUSPENDED_STATUS
  ) {
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

  if (month <= 4) return 1
  if (month === 5) return 0.75
  if (month === 6) return 0.5
  if (month === 7) return 0.25
  return 0
}

function classifyPlayerStatus(
  statusCode: string | null,
  statusDescription: string | null,
) {
  const merged = `${statusCode ?? ""} ${statusDescription ?? ""}`.toLowerCase()

  if (merged.includes("60")) return IL_60_STATUS
  if (merged.includes("10") || merged.includes("15") || merged.includes("injured")) {
    return IL_10_STATUS
  }
  if (merged.includes("minors") || merged.includes("optioned")) {
    return MINORS_STATUS
  }

  if (merged.includes("suspend") || merged.includes("restricted")) {
    return SUSPENDED_STATUS
  }

  return ACTIVE_STATUS
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

import { prisma } from "@/lib/prisma"
import { ScoringPeriodType } from "@prisma/client"
import { getSeasonToDateLines } from "@/server/stats/season-to-date"
import { estimateRemainingHomeRuns } from "./remaining-home-runs"

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

  const [periodStat, seasonLines, projection, historical] = await Promise.all([
    prisma.playerPeriodStat.findUnique({
      where: {
        playerId_scoringPeriodId: {
          playerId,
          scoringPeriodId: selectedPeriod.id,
        },
      },
    }),
    getSeasonToDateLines(seasonYear, [playerId]),
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

  const line = seasonLines.get(playerId)

  const forecast = await estimateRemainingHomeRuns({
    providerPlayerId,
    projectionHomeRuns: projection?.projectedHomeRuns ?? null,
    projectionAtBats: projection?.projectedAtBats ?? null,
    snapshotHomeRuns: line?.homeRuns ?? 0,
    snapshotAtBats: line?.atBats ?? 0,
    snapshotGamesPlayed: line?.gamesPlayed ?? 0,
    historicalAtBats: historical?.atBats ?? null,
    historicalGamesPlayed: historical?.gamesPlayed ?? null,
    seasonYear,
    scoringPeriodType: selectedPeriod.periodType,
    scoringPeriodStart: selectedPeriod.startDate,
    scoringPeriodEnd: selectedPeriod.endDate,
    asOfDate,
  })

  return currentHomeRuns + forecast.expectedRemainingHomeRuns
}

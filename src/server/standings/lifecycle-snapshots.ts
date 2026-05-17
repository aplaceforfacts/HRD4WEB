import { ScoringPeriodType } from "@prisma/client"
import { isPeriodActive } from "@/lib/periods"
import { prisma } from "@/lib/prisma"

const FIRST_SNAPSHOT_MONTH_INDEX = 5
const OPENING_PROJECTION_SOURCE = "win_odds_expected_final_hr"

type ScoringPeriodForSnapshots = {
  id: string
  label: string
  startDate: Date
  endDate: Date
  periodType: ScoringPeriodType
  sortOrder: number
}

type SeasonForSnapshots = {
  id: string
  scoringPeriods: ScoringPeriodForSnapshots[]
}

export type BiggestSurpriseRow = {
  entryId: string
  ownerName: string
  currentHomeRuns: number
  projectedHomeRuns: number
  surpriseHomeRuns: number
}

export function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function addDays(value: Date, days: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days)
}

function isJuneForward(asOfDate: Date) {
  return startOfLocalDay(asOfDate) >= new Date(asOfDate.getFullYear(), FIRST_SNAPSHOT_MONTH_INDEX, 1)
}

function activeMonthlyPeriods(
  periods: ScoringPeriodForSnapshots[],
  asOfDate: Date,
) {
  return periods.filter(
    (period) =>
      period.periodType === ScoringPeriodType.MONTHLY &&
      isPeriodActive(period, asOfDate),
  )
}

function shouldWriteOpeningProjectionSnapshot(asOfDate: Date) {
  return isJuneForward(asOfDate) && asOfDate.getDate() === 1
}

function shouldWriteStandingSnapshot(asOfDate: Date) {
  return isJuneForward(asOfDate) && asOfDate.getDate() >= 9
}

export async function writeLifecycleSnapshots({
  season,
  asOfDate = new Date(),
}: {
  season: SeasonForSnapshots
  asOfDate?: Date
}) {
  const snapshotDate = startOfLocalDay(asOfDate)
  const monthlyPeriods = activeMonthlyPeriods(season.scoringPeriods, asOfDate)

  const summaries: Array<{
    scoringPeriodId: string
    label: string
    openingProjectionSnapshots: number
    standingSnapshots: number
  }> = []

  for (const period of monthlyPeriods) {
    const openingProjectionSnapshots = shouldWriteOpeningProjectionSnapshot(snapshotDate)
      ? await writeOpeningProjectionSnapshots({
          seasonId: season.id,
          scoringPeriodId: period.id,
          snapshotDate,
        })
      : 0

    const standingSnapshots = shouldWriteStandingSnapshot(snapshotDate)
      ? await writeStandingSnapshots({
          seasonId: season.id,
          scoringPeriodId: period.id,
          snapshotDate,
        })
      : 0

    summaries.push({
      scoringPeriodId: period.id,
      label: period.label,
      openingProjectionSnapshots,
      standingSnapshots,
    })
  }

  return {
    periodsProcessed: summaries.length,
    openingProjectionSnapshots: summaries.reduce(
      (sum, row) => sum + row.openingProjectionSnapshots,
      0,
    ),
    standingSnapshots: summaries.reduce(
      (sum, row) => sum + row.standingSnapshots,
      0,
    ),
    summaries,
  }
}

async function writeOpeningProjectionSnapshots({
  seasonId,
  scoringPeriodId,
  snapshotDate,
}: {
  seasonId: string
  scoringPeriodId: string
  snapshotDate: Date
}) {
  const oddsRows = await prisma.entryWinOdds.findMany({
    where: {
      scoringPeriodId,
      expectedFinalHr: { not: null },
    },
    select: {
      entryId: true,
      expectedFinalHr: true,
    },
  })

  if (oddsRows.length === 0) {
    return 0
  }

  await prisma.$transaction(
    oddsRows.map((row) =>
      prisma.entryOpeningProjectionSnapshot.upsert({
        where: {
          entryId_scoringPeriodId_snapshotDate: {
            entryId: row.entryId,
            scoringPeriodId,
            snapshotDate,
          },
        },
        update: {
          seasonId,
          projectedHomeRuns: row.expectedFinalHr ?? 0,
          projectionSource: OPENING_PROJECTION_SOURCE,
        },
        create: {
          seasonId,
          entryId: row.entryId,
          scoringPeriodId,
          snapshotDate,
          projectedHomeRuns: row.expectedFinalHr ?? 0,
          projectionSource: OPENING_PROJECTION_SOURCE,
        },
      }),
    ),
  )

  return oddsRows.length
}

async function writeStandingSnapshots({
  seasonId,
  scoringPeriodId,
  snapshotDate,
}: {
  seasonId: string
  scoringPeriodId: string
  snapshotDate: Date
}) {
  const scoreRows = await prisma.entryPeriodScore.findMany({
    where: {
      scoringPeriodId,
      rank: { not: null },
    },
    select: {
      entryId: true,
      homeRuns: true,
      rank: true,
      isTied: true,
    },
  })

  if (scoreRows.length === 0) {
    return 0
  }

  await prisma.$transaction(
    scoreRows.map((row) =>
      prisma.entryStandingSnapshot.upsert({
        where: {
          entryId_scoringPeriodId_snapshotDate: {
            entryId: row.entryId,
            scoringPeriodId,
            snapshotDate,
          },
        },
        update: {
          seasonId,
          homeRuns: row.homeRuns,
          rank: row.rank ?? 0,
          isTied: row.isTied,
        },
        create: {
          seasonId,
          entryId: row.entryId,
          scoringPeriodId,
          snapshotDate,
          homeRuns: row.homeRuns,
          rank: row.rank ?? 0,
          isTied: row.isTied,
        },
      }),
    ),
  )

  return scoreRows.length
}

export async function getPreviousRankByEntryId({
  scoringPeriodId,
  asOfDate = new Date(),
}: {
  scoringPeriodId: string
  asOfDate?: Date
}) {
  const today = startOfLocalDay(asOfDate)

  if (!isJuneForward(today) || today.getDate() < 10) {
    return new Map<string, number>()
  }

  const snapshotDate = addDays(today, -1)
  const snapshots = await prisma.entryStandingSnapshot.findMany({
    where: {
      scoringPeriodId,
      snapshotDate,
    },
    select: {
      entryId: true,
      rank: true,
    },
  })

  return new Map(snapshots.map((snapshot) => [snapshot.entryId, snapshot.rank]))
}

export async function getBiggestSurprises({
  scoringPeriodId,
}: {
  scoringPeriodId: string
}) {
  const snapshots = await prisma.entryOpeningProjectionSnapshot.findMany({
    where: { scoringPeriodId },
    include: {
      entry: {
        include: {
          owner: true,
          periodScores: {
            where: { scoringPeriodId },
            take: 1,
          },
        },
      },
    },
  })

  const rows = snapshots
    .map((snapshot) => {
      const currentHomeRuns = snapshot.entry.periodScores[0]?.homeRuns ?? 0
      const surpriseHomeRuns = currentHomeRuns - snapshot.projectedHomeRuns

      return {
        entryId: snapshot.entryId,
        ownerName: snapshot.entry.owner.name,
        currentHomeRuns,
        projectedHomeRuns: snapshot.projectedHomeRuns,
        surpriseHomeRuns,
      }
    })
    .sort((a, b) => {
      if (b.surpriseHomeRuns !== a.surpriseHomeRuns) {
        return b.surpriseHomeRuns - a.surpriseHomeRuns
      }

      return a.ownerName.localeCompare(b.ownerName)
    })

  const topSurprise = rows[0]?.surpriseHomeRuns

  if (typeof topSurprise !== "number") {
    return []
  }

  return rows.filter((row) => row.surpriseHomeRuns === topSurprise)
}

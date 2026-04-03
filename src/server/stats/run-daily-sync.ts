import { prisma } from "@/lib/prisma"
import { calculateEntryPeriodScores } from "@/server/scoring/calculate-entry-period-scores"
import { calculatePlayerPeriodStats } from "@/server/scoring/calculate-player-period-stats"
import { computeOptimalLineup } from "@/server/scoring/compute-optimal-lineup"
import { computeEntryWinOdds } from "@/server/odds/compute-entry-win-odds"
import { importMlbSnapshotsForToday } from "./import-mlb-snapshots"

export async function runDailySync(seasonYear = 2026) {
  const season = await prisma.season.findUnique({
    where: { year: seasonYear },
    include: { scoringPeriods: true },
  })

  if (!season) {
    throw new Error(`Season ${seasonYear} not found.`)
  }

  const snapshotResult = await importMlbSnapshotsForToday(seasonYear)

  for (const period of season.scoringPeriods) {
    await calculatePlayerPeriodStats(season.id, period.id)
    await calculateEntryPeriodScores(season.id, period.id)
    await computeOptimalLineup(season.id, period.id)
  }

  const oddsResult = await computeEntryWinOdds(seasonYear)

  return {
    ok: true,
    seasonYear,
    importedSnapshots: snapshotResult.imported,
    periodsProcessed: season.scoringPeriods.length,
    oddsPeriodsProcessed: oddsResult.periodsProcessed,
    oddsSummaries: oddsResult.summaries,
  }
}

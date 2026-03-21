import { prisma } from "@/lib/prisma"
import { calculateEntryPeriodScores } from "@/server/scoring/calculate-entry-period-scores"
import { calculatePlayerPeriodStats } from "@/server/scoring/calculate-player-period-stats"
import { computeOptimalLineup } from "@/server/scoring/compute-optimal-lineup"

export async function runDailySync(seasonYear = 2026) {
  const season = await prisma.season.findUnique({
    where: { year: seasonYear },
    include: {
      scoringPeriods: true,
    },
  })

  if (!season) {
    throw new Error(`Season ${seasonYear} not found.`)
  }

  for (const period of season.scoringPeriods) {
    await calculatePlayerPeriodStats(season.id, period.id)
    await calculateEntryPeriodScores(season.id, period.id)
    await computeOptimalLineup(season.id, period.id)
  }

  return {
    ok: true,
    seasonYear,
    periodsProcessed: season.scoringPeriods.length,
  }
}

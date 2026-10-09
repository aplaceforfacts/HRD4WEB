import { calculateEntryPeriodScores } from "@/server/scoring/calculate-entry-period-scores"
import { calculatePlayerPeriodStats } from "@/server/scoring/calculate-player-period-stats"
import { computeOptimalLineup } from "@/server/scoring/compute-optimal-lineup"
import { computeEntryWinOdds } from "@/server/odds/compute-entry-win-odds"
import { getSeasonsForYear } from "@/server/season/resolve-season"
import { writeLifecycleSnapshots } from "@/server/standings/lifecycle-snapshots"
import { ensureProviderIds } from "./ensure-provider-ids"
import { importGameLogs } from "./import-game-logs"

/**
 * Nightly pipeline for one MLB year, across every league playing it: refresh game
 * logs once (they're shared), then score, rank and forecast each league's season.
 */
export async function runDailySync(seasonYear: number) {
  const seasons = await getSeasonsForYear(seasonYear)

  if (seasons.length === 0) {
    return { ok: true, seasonYear, seasons: [], message: `No league has a ${seasonYear} season.` }
  }

  await ensureProviderIds()
  const gameLogs = await importGameLogs(seasonYear, seasons.map((season) => season.id))

  const results = []

  for (const season of seasons) {
    for (const period of season.scoringPeriods) {
      await calculatePlayerPeriodStats(season.id, period.id)
      await calculateEntryPeriodScores(season.id, period.id)
      await computeOptimalLineup(season.id, period.id)
    }

    const odds = await computeEntryWinOdds(season)
    const lifecycle = await writeLifecycleSnapshots({ season })

    results.push({
      league: season.league.slug,
      seasonId: season.id,
      periodsProcessed: season.scoringPeriods.length,
      oddsPeriodsProcessed: odds.periodsProcessed,
      openingProjectionSnapshots: lifecycle.openingProjectionSnapshots,
      standingSnapshots: lifecycle.standingSnapshots,
    })
  }

  return { ok: true, seasonYear, gameLogs, seasons: results }
}

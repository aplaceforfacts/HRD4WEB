export const dynamic = "force-dynamic"

import Link from "next/link"
import { MetricCard } from "@/components/arc/metric-card/metric-card"
import { OddsTable, type OddsRow } from "@/components/odds/odds-table"
import { PeriodSwitcher } from "@/components/standings/period-switcher"
import { findPeriodBySlug, isPeriodActive, periodSlug } from "@/lib/periods"
import { leagueHref, linkContext } from "@/lib/paths"
import { getOddsBoard } from "@/server/odds/get-entry-win-odds"
import { requireSeasonContext } from "@/server/season/resolve-season"

export default async function OddsPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>
  searchParams: Promise<{ period?: string; season?: string }>
}) {
  const query = await searchParams
  const context = await requireSeasonContext((await params).league, query.season)
  const { season } = context
  const ctx = linkContext(context)

  const selectedPeriod = findPeriodBySlug(season.scoringPeriods, query.period)
  const selectedIsActive = isPeriodActive(selectedPeriod)
  const activePeriods = season.scoringPeriods.filter((period) => isPeriodActive(period))
  const odds = selectedIsActive ? await getOddsBoard(season.id, selectedPeriod.label) : null

  const rows: OddsRow[] = (odds?.rows ?? []).map((row) => ({
    id: row.id,
    rank: row.rank,
    isTied: row.isTied,
    teamName: row.teamName,
    currentHomeRuns: row.currentHomeRuns,
    expectedFinalHr: row.expectedFinalHr,
    winProbability: row.score,
    top3Probability: row.top3Probability,
  }))
  const favorite = rows[0]
  const contenders = rows.filter((row) => row.winProbability >= 0.01).length
  const updated = odds?.rows[0]?.simulatedAt

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Win Probability</h1>
          <p className="max-w-2xl text-neutral-600">
            Each team&apos;s chance to win, from 1,500 simulations of the rest of the period. Updated every morning.
          </p>
        </div>
        <Link href={leagueHref(ctx, "/standings")} className="secondary-button">
          Standings
        </Link>
      </div>

      {activePeriods.length > 1 ? (
        <PeriodSwitcher
          ctx={ctx}
          path="/odds"
          mode="query"
          periods={activePeriods.map((period) => ({ label: period.label, slug: periodSlug(period.label) }))}
          current={periodSlug(selectedPeriod.label)}
        />
      ) : null}

      {!selectedIsActive ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-neutral-600">
          {selectedPeriod.label} is over, so there are no odds to show. Final results are on the standings page.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-neutral-600">
          Odds for {selectedPeriod.label} appear after the next nightly sync.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <MetricCard
              label="Favorite"
              value={Math.round((favorite?.winProbability ?? 0) * 1000) / 10}
              suffix="%"
              context={favorite?.teamName ?? ""}
            />
            <MetricCard label="Live contenders" value={contenders} context="Teams with at least a 1% chance" />
            <MetricCard
              label="Expected winning total"
              value={Math.round(Math.max(...rows.map((row) => row.expectedFinalHr)))}
              suffix={" HR"}
              context={updated ? `As of ${updated.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}` : ""}
            />
          </div>

          <OddsTable rows={rows} periodLabel={selectedPeriod.label} />
        </>
      )}
    </div>
  )
}

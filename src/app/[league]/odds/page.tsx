export const dynamic = "force-dynamic"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { findPeriodBySlug, isPeriodActive, periodSlug } from "@/lib/periods"
import { leagueHref, linkContext } from "@/lib/paths"
import { getOddsBoard } from "@/server/odds/get-entry-win-odds"
import { requireSeasonContext } from "@/server/season/resolve-season"

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}


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
  const selectedPeriodLabel = selectedPeriod.label
  const selectedIsActive = isPeriodActive(selectedPeriod)
  const activePeriods = season.scoringPeriods.filter((period) =>
    isPeriodActive(period),
  )

  const odds = selectedIsActive ? await getOddsBoard(season.id, selectedPeriodLabel) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Win Probability</h1>
          <p className="text-neutral-600">
            Estimated chances to win each scoring period based on stored simulation results.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={leagueHref(ctx, "/standings")}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Standings
          </Link>
          <Link
            href={leagueHref(ctx, "/optimal", { period: periodSlug(selectedPeriodLabel) })}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Optimal lineup
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {activePeriods.map((period) => {
              const slug = periodSlug(period.label)
              const active = period.label === selectedPeriodLabel

              return (
                <Link key={period.id} href={leagueHref(ctx, "/odds", { period: slug })}>
                  <span
                    className={
                      active
                        ? "inline-flex rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-sm text-white"
                        : "inline-flex rounded-full border border-neutral-300 bg-white px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-50"
                    }
                  >
                    {period.label}
                  </span>
                </Link>
              )
            })}
          </div>

          <div>
            <h2 className="text-lg font-semibold">{selectedPeriodLabel} odds</h2>
            <p className="text-sm text-neutral-500">
              {selectedIsActive
                ? "Rankings are based on win probability. Ties share probability during simulation."
                : "This scoring period is complete, so win odds are hidden."}
            </p>
          </div>
        </CardHeader>
      </Card>

      {!selectedIsActive ? (
        <Card>
          <CardContent>
            <div className="text-neutral-600">
              Completed and archived periods keep their final standings instead of stale win probabilities.
            </div>
          </CardContent>
        </Card>
      ) : !odds || odds.rows.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-neutral-600">
              No stored odds are available for this scoring period yet. Run the daily sync after the odds job is wired in.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{odds.period.label}</h2>
                <Badge>{odds.rows.length} entries</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-neutral-500">
                      <th className="px-5 py-3">Rank</th>
                      <th className="px-5 py-3">Team</th>
                      <th className="px-5 py-3">Current HR</th>
                      <th className="px-5 py-3">Expected final HR</th>
                      <th className="px-5 py-3">Win %</th>
                      <th className="px-5 py-3">Top 3 %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {odds.rows.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                        <td className="px-5 py-4 font-medium">{row.rank}</td>
                        <td className="px-5 py-4">
                          <div className="font-medium">{row.teamName}</div>
                          {row.isTied ? (
                            <div className="text-xs text-neutral-500">Tied rank</div>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">{row.currentHomeRuns}</td>
                        <td className="px-5 py-4">{row.expectedFinalHr.toFixed(1)}</td>
                        <td className="px-5 py-4 font-semibold">{formatPercent(row.score)}</td>
                        <td className="px-5 py-4">{formatPercent(row.top3Probability)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 text-sm text-neutral-600">
              <p>
                These values come from saved odds rows, not on-page live simulation, so the page stays fast and reflects your scheduled sync output.
              </p>
              <p>
                Early in a scoring period, odds will move sharply. Later in the period, they should become much more stable.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

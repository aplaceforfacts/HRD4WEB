export const dynamic = "force-dynamic"

import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { EntrySearch } from "@/components/entry-search"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { periodLabelToSlug } from "@/lib/utils"
import { getOddsBoard } from "@/server/odds/get-entry-win-odds"

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export default async function HomePage() {
  const season = await prisma.season.findUnique({
    where: { year: 2026 },
    include: {
      scoringPeriods: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  const now = new Date()

  const currentMonthly =
    season?.scoringPeriods.find(
      (period) =>
        period.periodType === "MONTHLY" &&
        now >= period.startDate &&
        now <= period.endDate,
    ) ??
    season?.scoringPeriods
      .filter(
        (period) =>
          period.periodType === "MONTHLY" &&
          now >= period.startDate,
      )
      .sort((a, b) => b.sortOrder - a.sortOrder)[0] ??
    null

  const [seasonOdds, currentPeriodOdds] = await Promise.all([
    getOddsBoard("Season", 2026).catch(() => null),
    currentMonthly ? getOddsBoard(currentMonthly.label, 2026).catch(() => null) : null,
  ])

  const topSeasonRows = seasonOdds?.rows.slice(0, 3) ?? []
  const topCurrentRows = currentPeriodOdds?.rows.slice(0, 3) ?? []

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-neutral-200 bg-gradient-to-b from-neutral-50 to-white p-8 shadow-sm md:p-12">
        <div className="max-w-3xl space-y-5">
          <Badge>2026 Season</Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Home Run Derby</h1>
          <p className="text-lg leading-8 text-neutral-700 md:text-xl">
            Pick a 16-player preseason roster and chase the best home run total for the month and the full season.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/submit"
              className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              Submit Entry
            </Link>
            <Link
              href="/standings"
              className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
            >
              View Standings
            </Link>
          </div>
          <div className="pt-2">
            <EntrySearch />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Top 3 Season odds</h2>
                <p className="text-sm text-neutral-500">
                  Highest current chances to win the full season.
                </p>
              </div>
              <Link
                href="/odds?period=season"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                View all
              </Link>
            </div>

            {topSeasonRows.length === 0 ? (
              <div className="text-sm text-neutral-600">No season odds available yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-neutral-500">
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Current HR</th>
                      <th className="px-4 py-3">Expected final HR</th>
                      <th className="px-4 py-3">Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSeasonRows.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                        <td className="px-4 py-3 font-medium">{row.rank}</td>
                        <td className="px-4 py-3">{row.ownerName}</td>
                        <td className="px-4 py-3">{row.currentHomeRuns}</td>
                        <td className="px-4 py-3">{row.expectedFinalHr.toFixed(1)}</td>
                        <td className="px-4 py-3 font-semibold">{formatPercent(row.score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Top 3 {currentMonthly?.label ?? "Current period"} odds
                </h2>
                <p className="text-sm text-neutral-500">
                  Highest current chances to win the active scoring period.
                </p>
              </div>
              {currentMonthly ? (
                <Link
                  href={`/odds?period=${periodLabelToSlug(currentMonthly.label)}`}
                  className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                >
                  View all
                </Link>
              ) : null}
            </div>

            {topCurrentRows.length === 0 ? (
              <div className="text-sm text-neutral-600">
                No current-period odds available yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-neutral-500">
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Current HR</th>
                      <th className="px-4 py-3">Expected final HR</th>
                      <th className="px-4 py-3">Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCurrentRows.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                        <td className="px-4 py-3 font-medium">{row.rank}</td>
                        <td className="px-4 py-3">{row.ownerName}</td>
                        <td className="px-4 py-3">{row.currentHomeRuns}</td>
                        <td className="px-4 py-3">{row.expectedFinalHr.toFixed(1)}</td>
                        <td className="px-4 py-3 font-semibold">{formatPercent(row.score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-lg font-semibold">16-player entry</h2>
            <p className="text-sm leading-6 text-neutral-600">
              Choose one player from Groups A–L and four players from Group M.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-lg font-semibold">Six monthly races</h2>
            <p className="text-sm leading-6 text-neutral-600">
              March 25–April 30, then May, June, July, August, and September.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-lg font-semibold">Season-long crown</h2>
            <p className="text-sm leading-6 text-neutral-600">
              Only 2026 MLB regular-season home runs count. Ties are allowed.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
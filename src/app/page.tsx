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
        (period) => period.periodType === "MONTHLY" && now >= period.startDate,
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
      <section className="hero-surface p-8 md:p-12">
        <div className="relative z-10 max-w-3xl space-y-5">
          <Badge>2026 Season</Badge>

          <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
            Home Run Derby
          </h1>

          <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
            Pick a 16-player preseason roster and chase the best home run total
            for the month and the full season.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/submit" className="primary-button">
              Submit Entry
            </Link>
            <Link href="/standings" className="secondary-button">
              View Standings
            </Link>
          </div>

          <div className="pt-3">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur">
              <EntrySearch />
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[36%] overflow-hidden rounded-r-[2rem] bg-cover bg-center xl:block"
          style={{
            backgroundImage: "url('/hero-image-crop.jpg')",
            WebkitMaskImage: "linear-gradient(to left, black 70%, transparent 100%)",
            maskImage: "linear-gradient(to left, black 70%, transparent 100%)",
          }}
        />
      </section>

      <section className="space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Top 3 Season odds</h2>
                <p className="text-sm text-slate-500">
                  Highest current chances to win the full season.
                </p>
              </div>
              <Link
                href="/odds?period=season"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                View all
              </Link>
            </div>

            {topSeasonRows.length === 0 ? (
              <div className="text-sm text-slate-500">No season odds available yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Owner</th>
                      <th>Current HR</th>
                      <th>Expected final HR</th>
                      <th>Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSeasonRows.map((row) => (
                      <tr key={row.id}>
                        <td className="font-semibold text-slate-900">{row.rank}</td>
                        <td className="font-medium text-slate-900">{row.ownerName}</td>
                        <td className="tabular-nums">{row.currentHomeRuns}</td>
                        <td className="tabular-nums">{row.expectedFinalHr.toFixed(1)}</td>
                        <td className="font-semibold tabular-nums text-indigo-700">
                          {formatPercent(row.score)}
                        </td>
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
                <h2 className="text-lg font-semibold text-slate-950">
                  Top 3 {currentMonthly?.label ?? "Current period"} odds
                </h2>
                <p className="text-sm text-slate-500">
                  Highest current chances to win the active scoring period.
                </p>
              </div>
              {currentMonthly ? (
                <Link
                  href={`/odds?period=${periodLabelToSlug(currentMonthly.label)}`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  View all
                </Link>
              ) : null}
            </div>

            {topCurrentRows.length === 0 ? (
              <div className="text-sm text-slate-500">
                No current-period odds available yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Owner</th>
                      <th>Current HR</th>
                      <th>Expected final HR</th>
                      <th>Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCurrentRows.map((row) => (
                      <tr key={row.id}>
                        <td className="font-semibold text-slate-900">{row.rank}</td>
                        <td className="font-medium text-slate-900">{row.ownerName}</td>
                        <td className="tabular-nums">{row.currentHomeRuns}</td>
                        <td className="tabular-nums">{row.expectedFinalHr.toFixed(1)}</td>
                        <td className="font-semibold tabular-nums text-emerald-700">
                          {formatPercent(row.score)}
                        </td>
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
        <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="space-y-2">
            <div className="stat-chip">Format</div>
            <h2 className="text-lg font-semibold">16-player entry</h2>
            <p className="text-sm leading-6 text-slate-600">
              Choose one player from Groups A–L and four players from Group M.
            </p>
          </CardContent>
        </Card>

        <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="space-y-2">
            <div className="stat-chip">Schedule</div>
            <h2 className="text-lg font-semibold">Six monthly races</h2>
            <p className="text-sm leading-6 text-slate-600">
              March 25–April 30, then May, June, July, August, and September.
            </p>
          </CardContent>
        </Card>

        <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="space-y-2">
            <div className="stat-chip">Scoring</div>
            <h2 className="text-lg font-semibold">Season-long crown</h2>
            <p className="text-sm leading-6 text-slate-600">
              Only 2026 MLB regular-season home runs count. Ties are allowed.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
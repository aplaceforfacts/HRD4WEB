export const dynamic = "force-dynamic"

import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { EntrySearch } from "@/components/entry-search"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { isPeriodActive, periodSlug } from "@/lib/periods"
import { leagueHref, linkContext } from "@/lib/paths"
import { getOddsBoard } from "@/server/odds/get-entry-win-odds"
import { requireSeasonContext } from "@/server/season/resolve-season"

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

/** regularSeasonStart is stored as UTC midnight of opening day, so format it in UTC. */
function formatOpeningDay(value: Date) {
  return value.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>
  searchParams: Promise<{ season?: string }>
}) {
  const context = await requireSeasonContext((await params).league, (await searchParams).season)
  const { season, league } = context
  const ctx = linkContext(context)

  const [groups, entryCount] = await Promise.all([
    prisma.group.findMany({ where: { seasonId: season.id }, orderBy: { sortOrder: "asc" } }),
    prisma.entry.count({ where: { seasonId: season.id } }),
  ])

  const now = new Date()
  const monthlyPeriods = season.scoringPeriods.filter((period) => period.periodType === "MONTHLY")
  const rosterSize = groups.reduce((sum, group) => sum + group.selectionCount, 0)
  const singleGroups = groups.filter((group) => group.selectionCount === 1)
  const multiGroups = groups.filter((group) => group.selectionCount > 1)

  const currentMonthly =
    season.scoringPeriods.find(
      (period) =>
        period.periodType === "MONTHLY" &&
        isPeriodActive(period, now),
    ) ??
    null

  const currentPeriodOdds = currentMonthly
    ? await getOddsBoard(season.id, currentMonthly.label).catch(() => null)
    : null

  const topCurrentRows = currentPeriodOdds?.rows.slice(0, 3) ?? []

  return (
    <div className="space-y-10">
      <section className="hero-surface p-8 md:p-12">
        <div className="relative z-10 max-w-3xl space-y-5">
          <Badge>{season.year} Season · {entryCount} teams</Badge>

          <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
            {league.name}
          </h1>

          <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
            Pick a {rosterSize}-player preseason roster and chase the best home run total
            for the month and the full season.
          </p>

          <div className="flex flex-wrap gap-3">
            {season.entryStatus === "OPEN" ? (
              <Link href={leagueHref(ctx, "/submit")} className="primary-button">
                Submit Entry
              </Link>
            ) : null}
            <Link href={leagueHref(ctx, "/standings")} className="secondary-button">
              View Standings
            </Link>
          </div>

          <div className="pt-3">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur">
              <EntrySearch seasonId={season.id} ctx={ctx} />
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
                <h2 className="text-lg font-semibold text-slate-950">
                  Top 3 {currentMonthly?.label ?? "Current period"} odds
                </h2>
                <p className="text-sm text-slate-500">
                  Highest current chances to win the active scoring period.
                </p>
              </div>
              {currentMonthly ? (
                <Link
                  href={leagueHref(ctx, "/odds", { period: periodSlug(currentMonthly.label) })}
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
                      <th>Team</th>
                      <th>Current HR</th>
                      <th>Expected final HR</th>
                      <th>Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCurrentRows.map((row) => (
                      <tr key={row.id}>
                        <td className="font-semibold text-slate-900">{row.rank}</td>
                        <td className="font-medium text-slate-900">{row.teamName}</td>
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
            <h2 className="text-lg font-semibold">{rosterSize}-player entry</h2>
            <p className="text-sm leading-6 text-slate-600">
              {singleGroups.length > 0
                ? `Choose one player from each of Groups ${singleGroups[0].code}–${singleGroups[singleGroups.length - 1].code}`
                : ""}
              {multiGroups.map((group) => ` and ${group.selectionCount} players from ${group.name}`).join("")}.
            </p>
          </CardContent>
        </Card>

        <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="space-y-2">
            <div className="stat-chip">Schedule</div>
            <h2 className="text-lg font-semibold">{monthlyPeriods.length} monthly races</h2>
            <p className="text-sm leading-6 text-slate-600">
              {monthlyPeriods.map((period) => period.label).join(", ")}, starting{" "}
              {formatOpeningDay(season.regularSeasonStart)}.
            </p>
          </CardContent>
        </Card>

        <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="space-y-2">
            <div className="stat-chip">Scoring</div>
            <h2 className="text-lg font-semibold">Season-long crown</h2>
            <p className="text-sm leading-6 text-slate-600">
              Only {season.year} MLB regular-season home runs count. Ties are allowed.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

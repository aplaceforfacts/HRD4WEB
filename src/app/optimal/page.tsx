export const dynamic = "force-dynamic"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import { periodLabelToSlug } from "@/lib/utils"
import { getOptimalLineupByPeriodLabel } from "@/server/optimal/get-optimal-lineup"

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function getSelectedPeriodLabel(
  periods: Array<{ label: string }>,
  slug?: string,
) {
  if (!slug) return "Season"

  return (
    periods.find((period) => periodLabelToSlug(period.label) === slug)?.label ??
    "Season"
  )
}

export default async function OptimalPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>
}) {
  const params = (await searchParams) ?? {}

  const season = await prisma.season.findUnique({
    where: { year: 2026 },
    include: { scoringPeriods: { orderBy: { sortOrder: "asc" } } },
  })

  if (!season) {
    return <div>Season not found.</div>
  }

  const selectedPeriodLabel = getSelectedPeriodLabel(
    season.scoringPeriods,
    params.period,
  )

  const [lineup, totalEntries, picksByPlayer] = await Promise.all([
    getOptimalLineupByPeriodLabel(selectedPeriodLabel),
    prisma.entry.count({
      where: { season: { year: 2026 } },
    }),
    prisma.entryPlayer.groupBy({
      by: ["playerId"],
      where: { entry: { season: { year: 2026 } } },
      _count: { playerId: true },
    }),
  ])

  const pickCountMap = new Map<string, number>(
    picksByPlayer.map((row) => [row.playerId, row._count.playerId]),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Optimal Lineup</h1>
          <p className="text-neutral-600">
            The best possible roster for the selected scoring window.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/odds?period=${periodLabelToSlug(selectedPeriodLabel)}`}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Win odds
          </Link>
          <Link
            href="/standings"
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Standings
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {season.scoringPeriods.map((period) => {
              const slug = periodLabelToSlug(period.label)
              const active = period.label === selectedPeriodLabel

              return (
                <Link key={period.id} href={`/optimal?period=${slug}`}>
                  <Badge variant={active ? "default" : "secondary"}>{period.label}</Badge>
                </Link>
              )
            })}
          </div>

          {lineup ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-neutral-500">Scoring period</div>
                <div className="mt-1 text-lg font-semibold">{lineup.scoringPeriod.label}</div>
              </div>
              <Badge>{lineup.players.length} slots</Badge>
            </div>
          ) : (
            <div>
              <div className="text-sm text-neutral-500">Scoring period</div>
              <div className="mt-1 text-lg font-semibold">{selectedPeriodLabel}</div>
            </div>
          )}
        </CardHeader>
      </Card>

      {!lineup ? (
        <Card>
          <CardContent>
            <div className="text-neutral-600">
              No computed lineup exists for this scoring period yet. Run the sync after loading snapshots.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Best possible total</h2>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight">{lineup.totalHomeRuns} HR</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Best possible roster</h2>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-neutral-500">
                      <th className="px-5 py-3">Group</th>
                      <th className="px-5 py-3">Player</th>
                      <th className="px-5 py-3">HR</th>
                      <th className="px-5 py-3">Pick %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineup.players.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                        <td className="px-5 py-4 font-medium">{row.group.code}</td>
                        <td className="px-5 py-4">{row.player.fullName}</td>
                        <td className="px-5 py-4 font-semibold">{row.homeRuns}</td>
                        <td className="px-5 py-4 text-neutral-600">
                          {formatPercent(
                            totalEntries > 0
                              ? (pickCountMap.get(row.player.id) ?? 0) / totalEntries
                              : 0,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
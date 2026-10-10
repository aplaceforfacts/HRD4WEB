export const dynamic = "force-dynamic"

import Link from "next/link"
import { MetricCard } from "@/components/arc/metric-card/metric-card"
import { OptimalTable, type OptimalRow } from "@/components/optimal/optimal-table"
import { PeriodSwitcher } from "@/components/standings/period-switcher"
import { findPeriodBySlug, periodSlug } from "@/lib/periods"
import { leagueHref, linkContext } from "@/lib/paths"
import { prisma } from "@/lib/prisma"
import { getOptimalLineup } from "@/server/optimal/get-optimal-lineup"
import { requireSeasonContext } from "@/server/season/resolve-season"

export default async function OptimalPage({
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

  const [lineup, totalEntries, picksByPlayer, leader] = await Promise.all([
    getOptimalLineup(selectedPeriod.id),
    prisma.entry.count({ where: { seasonId: season.id } }),
    prisma.entryPlayer.groupBy({
      by: ["playerId"],
      where: { entry: { seasonId: season.id } },
      _count: { playerId: true },
    }),
    prisma.entryPeriodScore.findFirst({
      where: { scoringPeriodId: selectedPeriod.id },
      orderBy: { homeRuns: "desc" },
      select: { homeRuns: true },
    }),
  ])

  const pickCountMap = new Map(picksByPlayer.map((row) => [row.playerId, row._count.playerId]))
  const multiPickGroups = new Set(
    (lineup?.players ?? [])
      .filter((row, _, all) => all.filter((other) => other.group.code === row.group.code).length > 1)
      .map((row) => row.group.code),
  )

  const rows: OptimalRow[] = (lineup?.players ?? []).map((row) => ({
    id: row.id,
    order: row.group.sortOrder * 100 + row.slotNumber,
    groupLabel: multiPickGroups.has(row.group.code) ? `${row.group.code}-${row.slotNumber}` : row.group.code,
    playerName: row.player.fullName,
    homeRuns: row.homeRuns,
    pickPercentage: totalEntries > 0 ? (pickCountMap.get(row.player.id) ?? 0) / totalEntries : 0,
  }))

  const nobodyPicked = rows.filter((row) => row.pickPercentage === 0).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Optimal Lineup</h1>
          <p className="text-neutral-600">The best possible roster for the selected scoring period.</p>
        </div>
        <Link href={leagueHref(ctx, `/standings/${periodSlug(selectedPeriod.label)}`)} className="secondary-button">
          {selectedPeriod.label} standings
        </Link>
      </div>

      <PeriodSwitcher
        ctx={ctx}
        path="/optimal"
        mode="query"
        periods={season.scoringPeriods.map((period) => ({ label: period.label, slug: periodSlug(period.label) }))}
        current={periodSlug(selectedPeriod.label)}
      />

      {!lineup ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-neutral-600">
          No lineup has been computed for {selectedPeriod.label} yet. It appears after the first nightly sync of the period.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <MetricCard label="Best possible" value={lineup.totalHomeRuns} suffix={" HR"} context={`${rows.length} picks`} />
            <MetricCard
              label="Leader"
              value={leader?.homeRuns ?? 0}
              suffix={" HR"}
              context={
                lineup.totalHomeRuns
                  ? `${Math.round(((leader?.homeRuns ?? 0) / lineup.totalHomeRuns) * 100)}% of the best possible`
                  : "No scores yet"
              }
            />
            <MetricCard label="Nobody picked" value={nobodyPicked} context="Optimal players no team took" />
          </div>

          <OptimalTable rows={rows} periodLabel={selectedPeriod.label} />
        </>
      )}
    </div>
  )
}

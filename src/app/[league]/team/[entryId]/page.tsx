export const dynamic = "force-dynamic"
import { notFound, redirect } from "next/navigation"
import { PeriodTabs } from "@/components/period-tabs"
import { TeamGapTable } from "@/components/team-gap-table"
import { TeamRosterTable } from "@/components/team-roster-table"
import { TeamStatCards } from "@/components/team-stat-cards"
import { Card, CardContent } from "@/components/ui/card"
import { findPeriodBySlug, isPeriodCompleted, periodSlug } from "@/lib/periods"
import { prisma } from "@/lib/prisma"
import { getEntryDetail } from "@/server/entries/get-entry-detail"
import { getEntryGapAnalysis } from "@/server/entries/get-entry-gap-analysis"
import { pickCurrentSeason } from "@/server/season/resolve-season"

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string; entryId: string }>
  searchParams: Promise<{ period?: string; season?: string }>
}) {
  const { league, entryId } = await params
  const query = await searchParams

  // The entry fixes the season, so ?season= is only for keeping the header in step.
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: {
      season: {
        select: {
          year: true,
          league: { select: { slug: true } },
          scoringPeriods: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  })

  if (!entry || entry.season.league.slug !== league.toLowerCase()) notFound()

  const leagueSeasons = await prisma.season.findMany({
    where: { league: { slug: entry.season.league.slug } },
    orderBy: { year: "desc" },
    select: { year: true, entryStatus: true },
  })
  const current = pickCurrentSeason(leagueSeasons)
  const expectedSeasonParam = current?.year === entry.season.year ? undefined : String(entry.season.year)
  if (query.season !== expectedSeasonParam) {
    const next = new URLSearchParams()
    if (expectedSeasonParam) next.set("season", expectedSeasonParam)
    if (query.period) next.set("period", query.period)
    const suffix = next.toString()
    redirect(`/${entry.season.league.slug}/team/${entryId}${suffix ? `?${suffix}` : ""}`)
  }

  const period = findPeriodBySlug(entry.season.scoringPeriods, query.period)

  const [detail, gapAnalysis] = await Promise.all([
    getEntryDetail(entryId, period.label),
    getEntryGapAnalysis(entryId, period.label),
  ])

  if (!detail) notFound()

  const myScore = detail.myScore?.homeRuns ?? 0
  const myRank = detail.myScore?.rank ?? null
  const leaderHomeRuns = detail.leader?.homeRuns ?? 0
  const gapToLeader = Math.max(0, leaderHomeRuns - myScore)
  const gapToOptimal = gapAnalysis?.totalGap ?? 0
  const periodIsFinal = isPeriodCompleted(detail.period)

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">{detail.entry.teamName}</h1>
        <p className="text-neutral-600">{detail.period.label} view for {detail.entry.seasonName}</p>
        <PeriodTabs
          periods={entry.season.scoringPeriods.map((item) => ({ label: item.label, slug: periodSlug(item.label) }))}
          current={periodSlug(period.label)}
        />
      </div>

      <TeamStatCards
        myHomeRuns={myScore}
        myRank={myRank}
        leaderHomeRuns={leaderHomeRuns}
        gapToLeader={gapToLeader}
        gapToOptimal={gapToOptimal}
        isFinal={periodIsFinal}
      />

      <TeamRosterTable rows={detail.rosterRows} />

      {!periodIsFinal && gapAnalysis ? <TeamGapTable rows={gapAnalysis.rows} /> : null}

      {!periodIsFinal ? (
        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-lg font-semibold">What this means</h2>
            <p className="text-sm leading-6 text-neutral-600">
              Use this page to see whether your roster is winning because of one monster pick, broad category strength, or a particularly strong multi-pick group.
              The gap-to-optimal section shows where the most value was left on the table for the selected scoring period.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

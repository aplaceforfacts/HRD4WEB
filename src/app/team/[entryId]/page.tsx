import { notFound } from "next/navigation"
import { PeriodTabs } from "@/components/period-tabs"
import { TeamGapTable } from "@/components/team-gap-table"
import { TeamRosterTable } from "@/components/team-roster-table"
import { TeamStatCards } from "@/components/team-stat-cards"
import { Card, CardContent } from "@/components/ui/card"
import { PERIODS } from "@/lib/periods"
import { slugToPeriodLabel } from "@/lib/utils"
import { getEntryDetail } from "@/server/entries/get-entry-detail"
import { getEntryGapAnalysis } from "@/server/entries/get-entry-gap-analysis"

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { entryId } = await params
  const { period = "season" } = await searchParams
  const periodLabel = slugToPeriodLabel(period)

  const [detail, gapAnalysis] = await Promise.all([
    getEntryDetail(entryId, periodLabel),
    getEntryGapAnalysis(entryId, periodLabel),
  ])

  if (!detail) notFound()

  const myScore = detail.myScore?.homeRuns ?? 0
  const myRank = detail.myScore?.rank ?? null
  const leaderHomeRuns = detail.leader?.homeRuns ?? 0
  const gapToLeader = Math.max(0, leaderHomeRuns - myScore)
  const gapToOptimal = gapAnalysis?.totalGap ?? 0

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">{detail.entry.ownerName}'s Team</h1>
        <p className="text-neutral-600">{detail.period.label} view for {detail.entry.seasonName}</p>
        <PeriodTabs periods={PERIODS} />
      </div>

      <TeamStatCards
        myHomeRuns={myScore}
        myRank={myRank}
        leaderHomeRuns={leaderHomeRuns}
        gapToLeader={gapToLeader}
        gapToOptimal={gapToOptimal}
      />

      <TeamRosterTable rows={detail.rosterRows} />

      {gapAnalysis ? <TeamGapTable rows={gapAnalysis.rows} /> : null}

      <Card>
        <CardContent className="space-y-2">
          <h2 className="text-lg font-semibold">What this means</h2>
          <p className="text-sm leading-6 text-neutral-600">
            Use this page to see whether your roster is winning because of one monster pick, broad category strength, or a particularly good Group M.
            The gap-to-optimal section shows where the most value was left on the table for the selected scoring period.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

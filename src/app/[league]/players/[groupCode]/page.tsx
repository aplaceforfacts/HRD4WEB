export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { GroupRankingsTable } from "@/components/players/group-rankings-table"
import { PeriodSwitcher } from "@/components/standings/period-switcher"
import { linkContext } from "@/lib/paths"
import { findPeriodBySlug, periodSlug } from "@/lib/periods"
import { getGroupRankings } from "@/server/players/get-group-rankings"
import { requireSeasonContext } from "@/server/season/resolve-season"

export default async function GroupPlayersPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string; groupCode: string }>
  searchParams: Promise<{ period?: string; season?: string }>
}) {
  const { league, groupCode } = await params
  const query = await searchParams
  const context = await requireSeasonContext(league, query.season)
  const { season } = context
  const period = findPeriodBySlug(season.scoringPeriods, query.period)

  const data = await getGroupRankings(season.id, groupCode, period.label)
  if (!data) notFound()

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">{data.group.name} Rankings</h1>
        <PeriodSwitcher
          ctx={linkContext(context)}
          path={`/players/${data.group.code}`}
          mode="query"
          periods={season.scoringPeriods.map((item) => ({ label: item.label, slug: periodSlug(item.label) }))}
          current={periodSlug(period.label)}
        />
      </div>

      <GroupRankingsTable rows={data.rows} groupName={data.group.name} />
    </div>
  )
}

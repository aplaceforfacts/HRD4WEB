export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { PeriodTabs } from "@/components/period-tabs"
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
  const { season } = await requireSeasonContext(league, query.season)
  const period = findPeriodBySlug(season.scoringPeriods, query.period)

  const data = await getGroupRankings(season.id, groupCode, period.label)
  if (!data) notFound()

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">{data.group.name} Rankings</h1>
        <PeriodTabs
          periods={season.scoringPeriods.map((item) => ({ label: item.label, slug: periodSlug(item.label) }))}
          current={periodSlug(period.label)}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="px-5 py-3">Rank</th>
              <th className="px-5 py-3">Player</th>
              <th className="px-5 py-3">Team</th>
              <th className="px-5 py-3">HR</th>
              <th className="px-5 py-3">Projected HR</th>
              <th className="px-5 py-3">Pick %</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-5 py-4">{row.rank}</td>
                <td className="px-5 py-4">{row.fullName}</td>
                <td className="px-5 py-4">{row.mlbTeam ?? "—"}</td>
                <td className="px-5 py-4">{row.score}</td>
                <td className="px-5 py-4">
                  {typeof row.projectedScore === "number"
                    ? row.projectedScore.toFixed(1)
                    : "--"}
                </td>
                <td className="px-5 py-4">
                  {typeof row.pickPercentage === "number"
                    ? `${(row.pickPercentage * 100).toFixed(1)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

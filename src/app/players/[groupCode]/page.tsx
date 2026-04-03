export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { PeriodTabs } from "@/components/period-tabs"
import { PERIODS } from "@/lib/periods"
import { slugToPeriodLabel } from "@/lib/utils"
import { getGroupRankings } from "@/server/players/get-group-rankings"

export default async function GroupPlayersPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupCode: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { groupCode } = await params
  const { period } = await searchParams
  const periodLabel = slugToPeriodLabel(period ?? "season")

  const data = await getGroupRankings(groupCode, periodLabel)
  if (!data) notFound()

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">{data.group.name} Rankings</h1>
        <PeriodTabs periods={PERIODS} />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
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
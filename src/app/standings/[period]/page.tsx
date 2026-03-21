import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { slugToPeriodLabel } from "@/lib/utils"
import { getStandingsByPeriodLabel } from "@/server/standings/get-standings"

export default async function PeriodStandingsPage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params
  const label = slugToPeriodLabel(period)
  const standings = await getStandingsByPeriodLabel(label)

  if (!standings) notFound()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{standings.period.label} Standings</h1>
        <p className="text-neutral-600">
          {standings.period.startDate.toDateString()} – {standings.period.endDate.toDateString()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Leaderboard</h2>
            <Badge>{standings.rows.length} entries</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">HR</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {standings.rows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-5 py-4 font-medium">{row.rank}</td>
                    <td className="px-5 py-4">
                      <Link className="font-medium text-neutral-900 underline-offset-4 hover:underline" href={`/team/${row.entryId}?period=${period}`}>
                        {row.ownerName}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-semibold">{row.score}</td>
                    <td className="px-5 py-4">{row.isTied ? <Badge>Tied</Badge> : <span className="text-neutral-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

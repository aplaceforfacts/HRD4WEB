export const dynamic = "force-dynamic"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getOptimalLineupByPeriodLabel } from "@/server/optimal/get-optimal-lineup"

export default async function OptimalPage() {
  const lineup = await getOptimalLineupByPeriodLabel("Season")

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Optimal Lineup</h1>
        <p className="text-neutral-600">The best possible roster for the selected scoring window.</p>
      </div>

      {!lineup ? (
        <Card>
          <CardContent>
            <div className="text-neutral-600">No computed lineup yet. Run the sync after loading snapshots.</div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-neutral-500">Scoring period</div>
                  <div className="mt-1 text-lg font-semibold">{lineup.scoringPeriod.label}</div>
                </div>
                <Badge>{lineup.players.length} slots</Badge>
              </div>
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
                      <th className="px-5 py-3">Slot</th>
                      <th className="px-5 py-3">HR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineup.players.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                        <td className="px-5 py-4 font-medium">{row.group.code}</td>
                        <td className="px-5 py-4">{row.player.fullName}</td>
                        <td className="px-5 py-4">{row.slotNumber}</td>
                        <td className="px-5 py-4 font-semibold">{row.homeRuns}</td>
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

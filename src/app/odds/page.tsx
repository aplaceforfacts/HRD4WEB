import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { computeWinProbabilities } from "@/server/odds/compute-win-probabilities"

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export default async function OddsPage() {
  const odds = await computeWinProbabilities("Season", 2000)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Win Probability</h1>
        <p className="text-neutral-600">
          Estimated season-winning chances based on current totals and projected remaining home runs.
        </p>
        <Badge>{odds.simulations.toLocaleString()} simulations</Badge>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Season odds</h2>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Current HR</th>
                  <th className="px-5 py-3">Expected final HR</th>
                  <th className="px-5 py-3">Win %</th>
                  <th className="px-5 py-3">Top 3 %</th>
                </tr>
              </thead>
              <tbody>
                {odds.results.map((row) => (
                  <tr key={row.entryId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-5 py-4 font-medium">{row.ownerName}</td>
                    <td className="px-5 py-4">{row.currentHr}</td>
                    <td className="px-5 py-4">{row.expectedFinalHr.toFixed(1)}</td>
                    <td className="px-5 py-4 font-semibold">{pct(row.winProbability)}</td>
                    <td className="px-5 py-4">{pct(row.top3Probability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 text-sm text-neutral-600">
          <p>
            These odds are estimates, not guarantees. They depend on current scoring, the loaded projection source, and a simplified home-run simulation model.
          </p>
          <p>
            Early in the season, they will move a lot. Later in the season, they should stabilize and become more useful.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

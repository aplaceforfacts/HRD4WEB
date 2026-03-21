import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

type TeamRosterRow = {
  entryPlayerId: string
  slotNumber: number
  groupCode: string
  groupName: string
  playerId: string
  playerName: string
  team: string | null
  homeRuns: number
  rankInGroup: number | null
  isTied: boolean
}

export function TeamRosterTable({ rows }: { rows: TeamRosterRow[] }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Your roster contributions</h2>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-5 py-3">Group</th>
                <th className="px-5 py-3">Player</th>
                <th className="px-5 py-3">Team</th>
                <th className="px-5 py-3">HR</th>
                <th className="px-5 py-3">Cat. rank</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.entryPlayerId} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-4 font-medium">
                    {row.groupCode}
                    {row.groupCode === "M" ? `-${row.slotNumber}` : ""}
                  </td>
                  <td className="px-5 py-4">{row.playerName}</td>
                  <td className="px-5 py-4">{row.team ?? "—"}</td>
                  <td className="px-5 py-4 font-semibold">{row.homeRuns}</td>
                  <td className="px-5 py-4">
                    {row.rankInGroup ? (
                      <span className="inline-flex items-center gap-2">
                        #{row.rankInGroup}
                        {row.isTied ? <Badge>Tied</Badge> : null}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

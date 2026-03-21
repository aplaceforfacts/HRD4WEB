import { Card, CardContent, CardHeader } from "@/components/ui/card"

type GapRow = {
  groupCode: string
  slotNumber: number
  optimalPlayerName: string
  optimalHomeRuns: number
  yourPlayerName: string | null
  yourHomeRuns: number
  gap: number
}

export function TeamGapTable({ rows }: { rows: GapRow[] }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Gap to optimal</h2>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-5 py-3">Group</th>
                <th className="px-5 py-3">Your pick</th>
                <th className="px-5 py-3">Your HR</th>
                <th className="px-5 py-3">Optimal pick</th>
                <th className="px-5 py-3">Optimal HR</th>
                <th className="px-5 py-3">Gap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.groupCode}-${row.slotNumber}`} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-4 font-medium">
                    {row.groupCode}
                    {row.groupCode === "M" ? `-${row.slotNumber}` : ""}
                  </td>
                  <td className="px-5 py-4">{row.yourPlayerName ?? "—"}</td>
                  <td className="px-5 py-4">{row.yourHomeRuns}</td>
                  <td className="px-5 py-4">{row.optimalPlayerName}</td>
                  <td className="px-5 py-4">{row.optimalHomeRuns}</td>
                  <td className="px-5 py-4 font-semibold">{row.gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

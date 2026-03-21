import { Card, CardContent } from "@/components/ui/card"

export function TeamStatCards({
  myHomeRuns,
  myRank,
  leaderHomeRuns,
  gapToLeader,
  gapToOptimal,
}: {
  myHomeRuns: number
  myRank: number | null
  leaderHomeRuns: number
  gapToLeader: number
  gapToOptimal: number
}) {
  const cards = [
    { label: "Your HR", value: myHomeRuns },
    { label: "Your rank", value: myRank ?? "—" },
    { label: "Leader HR", value: leaderHomeRuns },
    { label: "Gap to leader", value: gapToLeader },
    { label: "Gap to optimal", value: gapToOptimal },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="space-y-2">
            <div className="text-sm text-neutral-500">{card.label}</div>
            <div className="text-3xl font-bold tracking-tight">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

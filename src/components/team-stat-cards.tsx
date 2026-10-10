import { MetricCard } from "@/components/arc/metric-card/metric-card"

const HR = " HR"

export function TeamStatCards({
  myHomeRuns,
  myRank,
  teamCount,
  leaderHomeRuns,
  gapToLeader,
  gapToOptimal,
  isFinal = false,
}: {
  myHomeRuns: number
  myRank: number | null
  teamCount: number
  leaderHomeRuns: number
  gapToLeader: number
  gapToOptimal: number
  isFinal?: boolean
}) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${isFinal ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
      <MetricCard label={isFinal ? "Final HR" : "Your HR"} value={myHomeRuns} suffix={HR} context="This period" />
      <MetricCard
        label={isFinal ? "Final place" : "Your place"}
        value={myRank ?? 0}
        context={myRank ? `of ${teamCount} teams` : "Not ranked yet"}
      />
      <MetricCard label={isFinal ? "Winner" : "Leader"} value={leaderHomeRuns} suffix={HR} context="Top score this period" />
      <MetricCard
        label={isFinal ? "Final gap" : "Gap to leader"}
        value={gapToLeader}
        suffix={HR}
        context={gapToLeader === 0 ? "You're in front" : "Behind first place"}
      />
      {!isFinal ? (
        <MetricCard label="Gap to optimal" value={gapToOptimal} suffix={HR} context="Left on the table so far" />
      ) : null}
    </div>
  )
}

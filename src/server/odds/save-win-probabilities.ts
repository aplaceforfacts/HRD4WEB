import { prisma } from "@/lib/prisma"
import { computeWinProbabilities } from "./compute-win-probabilities"

export async function saveWinProbabilities(periodLabel = "Season", simulations = 2000) {
  const odds = await computeWinProbabilities(periodLabel, simulations)

  const scoringPeriod = await prisma.scoringPeriod.findFirst({
    where: {
      season: { year: 2026 },
      label: periodLabel,
    },
  })

  if (!scoringPeriod) throw new Error("Scoring period not found")

  for (const row of odds.results) {
    await prisma.entryWinOdds.upsert({
      where: {
        entryId_scoringPeriodId: {
          entryId: row.entryId,
          scoringPeriodId: scoringPeriod.id,
        },
      },
      update: {
        seasonId: scoringPeriod.seasonId,
        winProbability: row.winProbability,
        top3Probability: row.top3Probability,
        expectedFinalHr: row.expectedFinalHr,
        simulatedAt: new Date(),
      },
      create: {
        seasonId: scoringPeriod.seasonId,
        entryId: row.entryId,
        scoringPeriodId: scoringPeriod.id,
        winProbability: row.winProbability,
        top3Probability: row.top3Probability,
        expectedFinalHr: row.expectedFinalHr,
        simulatedAt: new Date(),
      },
    })
  }

  return odds
}

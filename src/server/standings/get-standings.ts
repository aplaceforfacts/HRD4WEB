import { prisma } from "@/lib/prisma"
import { assignRanksDescending } from "@/server/scoring/assign-ranks"

export async function getStandingsByPeriodLabel(periodLabel: string) {
  const period = await prisma.scoringPeriod.findFirst({
    where: {
      season: { year: 2026 },
      label: periodLabel,
    },
    include: {
      entryScores: {
        include: {
          entry: {
            include: {
              owner: true,
            },
          },
        },
        orderBy: [{ homeRuns: "desc" }, { entry: { owner: { name: "asc" } } }],
      },
    },
  })

  if (!period) return null

  const ranked = assignRanksDescending(
    period.entryScores.map((score) => ({
      id: score.id,
      entryId: score.entryId,
      ownerName: score.entry.owner.name,
      score: score.homeRuns,
    })),
  )

  return {
    period: {
      id: period.id,
      label: period.label,
      startDate: period.startDate,
      endDate: period.endDate,
    },
    rows: ranked,
  }
}

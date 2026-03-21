import { prisma } from "@/lib/prisma"

export async function getOptimalLineupByPeriodLabel(periodLabel: string) {
  const lineup = await prisma.optimalLineup.findFirst({
    where: {
      scoringPeriod: {
        label: periodLabel,
        season: { year: 2026 },
      },
    },
    include: {
      players: {
        include: {
          player: true,
          group: true,
        },
        orderBy: [{ group: { sortOrder: "asc" } }, { slotNumber: "asc" }],
      },
      scoringPeriod: true,
    },
  })

  return lineup
}

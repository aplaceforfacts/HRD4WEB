import { prisma } from "@/lib/prisma"

export async function getOptimalLineup(scoringPeriodId: string) {
  return prisma.optimalLineup.findUnique({
    where: { scoringPeriodId },
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
}

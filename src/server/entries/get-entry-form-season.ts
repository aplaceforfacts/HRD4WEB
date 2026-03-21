import { prisma } from "@/lib/prisma"

export async function getEntryFormSeason(year = 2026) {
  return prisma.season.findUnique({
    where: { year },
    include: {
      groups: {
        orderBy: { sortOrder: "asc" },
        include: {
          seasonPlayers: {
            include: {
              player: {
                include: {
                  historicalStats: {
                    where: {
                      seasonYear: { in: [2025, 2024] },
                    },
                    orderBy: { seasonYear: "desc" },
                  },
                  projections: {
                    where: {
                      seasonYear: 2026,
                    },
                    orderBy: { source: "asc" },
                  },
                },
              },
            },
            orderBy: { displayOrder: "asc" },
          },
        },
      },
    },
  })
}

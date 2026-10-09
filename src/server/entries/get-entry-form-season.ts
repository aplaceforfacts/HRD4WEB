import { prisma } from "@/lib/prisma"

/** The season with its groups and player pool, plus each player's last two seasons and projections. */
export async function getEntryFormSeason(seasonId: string) {
  const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { year: true } })
  if (!season) return null

  return prisma.season.findUnique({
    where: { id: seasonId },
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
                      seasonYear: { in: [season.year - 1, season.year - 2] },
                    },
                    orderBy: { seasonYear: "desc" },
                  },
                  projections: {
                    where: {
                      seasonYear: season.year,
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

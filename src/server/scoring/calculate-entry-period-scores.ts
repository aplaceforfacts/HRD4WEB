import { prisma } from "@/lib/prisma"
import { assignRanksDescending } from "./assign-ranks"

export async function calculateEntryPeriodScores(seasonId: string, scoringPeriodId: string) {
  const entries = await prisma.entry.findMany({
    where: { seasonId },
    include: {
      players: true,
    },
  })

  for (const entry of entries) {
    const stats = await prisma.playerPeriodStat.findMany({
      where: {
        scoringPeriodId,
        playerId: {
          in: entry.players.map((player) => player.playerId),
        },
      },
      select: { homeRuns: true },
    })

    const homeRuns = stats.reduce((sum, stat) => sum + stat.homeRuns, 0)

    await prisma.entryPeriodScore.upsert({
      where: {
        entryId_scoringPeriodId: {
          entryId: entry.id,
          scoringPeriodId,
        },
      },
      update: {
        seasonId,
        homeRuns,
      },
      create: {
        seasonId,
        entryId: entry.id,
        scoringPeriodId,
        homeRuns,
      },
    })
  }

  const scores = await prisma.entryPeriodScore.findMany({
    where: { scoringPeriodId },
    include: {
      entry: {
        include: {
          owner: true,
        },
      },
    },
    orderBy: [{ homeRuns: "desc" }, { entry: { owner: { name: "asc" } } }],
  })

  const ranked = assignRanksDescending(
    scores.map((score) => ({
      id: score.id,
      score: score.homeRuns,
    })),
  )

  for (const item of ranked) {
    await prisma.entryPeriodScore.update({
      where: { id: item.id },
      data: {
        rank: item.rank,
        isTied: item.isTied,
      },
    })
  }
}

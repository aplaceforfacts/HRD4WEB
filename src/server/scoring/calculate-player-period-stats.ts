import { prisma } from "@/lib/prisma"
import { assignRanksDescending } from "./assign-ranks"

async function getLatestSnapshotOnOrBefore(playerId: string, seasonId: string, date: Date) {
  return prisma.playerStatSnapshot.findFirst({
    where: {
      playerId,
      seasonId,
      snapshotDate: { lte: date },
    },
    orderBy: { snapshotDate: "desc" },
  })
}

async function getLatestSnapshotBefore(playerId: string, seasonId: string, date: Date) {
  return prisma.playerStatSnapshot.findFirst({
    where: {
      playerId,
      seasonId,
      snapshotDate: { lt: date },
    },
    orderBy: { snapshotDate: "desc" },
  })
}

export async function calculatePlayerPeriodStats(seasonId: string, scoringPeriodId: string) {
  const [period, seasonPlayers] = await Promise.all([
    prisma.scoringPeriod.findUnique({ where: { id: scoringPeriodId } }),
    prisma.seasonPlayerGroup.findMany({
      where: { seasonId },
      include: {
        player: true,
        group: true,
      },
    }),
  ])

  if (!period) throw new Error("Scoring period not found.")

  for (const row of seasonPlayers) {
    const endSnapshot = await getLatestSnapshotOnOrBefore(row.playerId, seasonId, period.endDate)
    const beforeSnapshot = await getLatestSnapshotBefore(row.playerId, seasonId, period.startDate)

    const homeRuns = Math.max(0, (endSnapshot?.homeRuns ?? 0) - (beforeSnapshot?.homeRuns ?? 0))
    const atBats = Math.max(0, (endSnapshot?.atBats ?? 0) - (beforeSnapshot?.atBats ?? 0))

    await prisma.playerPeriodStat.upsert({
      where: {
        playerId_scoringPeriodId: {
          playerId: row.playerId,
          scoringPeriodId,
        },
      },
      update: {
        seasonId,
        groupId: row.groupId,
        homeRuns,
        atBats,
        sluggingPct: endSnapshot?.sluggingPct ?? null,
      },
      create: {
        seasonId,
        playerId: row.playerId,
        scoringPeriodId,
        groupId: row.groupId,
        homeRuns,
        atBats,
        sluggingPct: endSnapshot?.sluggingPct ?? null,
      },
    })
  }

  const groups = await prisma.group.findMany({ where: { seasonId } })

  for (const group of groups) {
    const stats = await prisma.playerPeriodStat.findMany({
      where: {
        scoringPeriodId,
        groupId: group.id,
      },
      include: { player: true },
      orderBy: [{ homeRuns: "desc" }, { player: { fullName: "asc" } }],
    })

    const ranked = assignRanksDescending(
      stats.map((stat) => ({
        id: stat.id,
        score: stat.homeRuns,
      })),
    )

    for (const item of ranked) {
      await prisma.playerPeriodStat.update({
        where: { id: item.id },
        data: {
          rankInGroup: item.rank,
          isTied: item.isTied,
        },
      })
    }
  }
}

import { prisma } from "@/lib/prisma"
import { assignRanksDescending } from "./assign-ranks"
import { getPeriodGameDateRange } from "./scoring-period-windows"

/**
 * A player's period line is the sum of his game-log rows whose official MLB game
 * date falls inside the period. This matches how the league host counts (by game
 * date) and needs no baseline snapshot, so late-added players and corrected MLB IDs
 * score correctly for every past month as soon as their log is re-imported.
 */
export async function calculatePlayerPeriodStats(seasonId: string, scoringPeriodId: string) {
  const [period, season, seasonPlayers] = await Promise.all([
    prisma.scoringPeriod.findUnique({ where: { id: scoringPeriodId } }),
    prisma.season.findUnique({ where: { id: seasonId }, select: { year: true } }),
    prisma.seasonPlayerGroup.findMany({
      where: { seasonId },
      select: { playerId: true, groupId: true },
    }),
  ])

  if (!period) throw new Error("Scoring period not found.")
  if (!season) throw new Error("Season not found.")

  const { from, to } = getPeriodGameDateRange(period)

  const totals = await prisma.playerGameLog.groupBy({
    by: ["playerId"],
    where: {
      seasonYear: season.year,
      playerId: { in: seasonPlayers.map((row) => row.playerId) },
      gameDate: { gte: from, lt: to },
    },
    _sum: { homeRuns: true, atBats: true, totalBases: true },
  })

  const totalsByPlayer = new Map(totals.map((row) => [row.playerId, row._sum]))

  await prisma.$transaction(
    seasonPlayers.map((row) => {
      const sum = totalsByPlayer.get(row.playerId)
      const homeRuns = sum?.homeRuns ?? 0
      const atBats = sum?.atBats ?? 0
      const sluggingPct = atBats > 0 ? (sum?.totalBases ?? 0) / atBats : null

      return prisma.playerPeriodStat.upsert({
        where: {
          playerId_scoringPeriodId: {
            playerId: row.playerId,
            scoringPeriodId,
          },
        },
        update: { seasonId, groupId: row.groupId, homeRuns, atBats, sluggingPct },
        create: {
          seasonId,
          playerId: row.playerId,
          scoringPeriodId,
          groupId: row.groupId,
          homeRuns,
          atBats,
          sluggingPct,
        },
      })
    }),
  )

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

    await prisma.$transaction(
      ranked.map((item) =>
        prisma.playerPeriodStat.update({
          where: { id: item.id },
          data: {
            rankInGroup: item.rank,
            isTied: item.isTied,
          },
        }),
      ),
    )
  }
}

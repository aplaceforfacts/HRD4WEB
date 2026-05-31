import { prisma } from "@/lib/prisma"
import { assignRanksDescending } from "./assign-ranks"

const TEAM_SCOPED_SNAPSHOT_SOURCES = ["batch-ingest", "batch-ingest-repair", "csv-import"]

function teamCodeAliases(teamCode: string | null) {
  if (!teamCode) return []

  const normalized = teamCode.trim().toLowerCase()
  if (["a's", "as", "ath", "oak", "athletics", "oakland athletics"].includes(normalized)) {
    return ["A's", "AS", "ATH", "OAK", "Athletics", "Oakland Athletics"]
  }

  if (["lad", "la", "dodgers", "los angeles dodgers"].includes(normalized)) {
    return ["LAD", "LA", "Dodgers", "Los Angeles Dodgers"]
  }

  return [teamCode]
}

function usableSnapshotWhere(playerTeamCode: string | null) {
  const aliases = teamCodeAliases(playerTeamCode)

  if (aliases.length === 0) return {}

  return {
    OR: [
      { sourceName: { notIn: TEAM_SCOPED_SNAPSHOT_SOURCES } },
      { teamCode: null },
      { teamCode: { in: aliases } },
    ],
  }
}

async function getLatestSnapshotBefore(
  playerId: string,
  seasonId: string,
  playerTeamCode: string | null,
  date: Date,
) {
  return prisma.playerStatSnapshot.findFirst({
    where: {
      playerId,
      seasonId,
      snapshotDate: { lt: date },
      ...usableSnapshotWhere(playerTeamCode),
    },
    orderBy: { snapshotDate: "desc" },
  })
}

async function getLatestSnapshotAtOrBefore(
  playerId: string,
  seasonId: string,
  playerTeamCode: string | null,
  date: Date,
) {
  return prisma.playerStatSnapshot.findFirst({
    where: {
      playerId,
      seasonId,
      snapshotDate: { lte: date },
      ...usableSnapshotWhere(playerTeamCode),
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
    const endSnapshot = await getLatestSnapshotBefore(
      row.playerId,
      seasonId,
      row.player.mlbTeam,
      period.endDate,
    )
    const beforeSnapshot = await getLatestSnapshotAtOrBefore(
      row.playerId,
      seasonId,
      row.player.mlbTeam,
      period.startDate,
    )

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

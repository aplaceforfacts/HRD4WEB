import { prisma } from "@/lib/prisma"
import { getPlayerGameLog, getTeamAbbreviations } from "./mlb-stats-api"

const CONCURRENCY = 8

type PlayerToImport = { id: string; providerPlayerId: string }

async function importOne(player: PlayerToImport, seasonYear: number, teamCodes: Map<number, string | null>) {
  const rows = await getPlayerGameLog(Number(player.providerPlayerId), seasonYear)
  const latestTeamId = rows[rows.length - 1]?.teamId ?? null
  const latestTeamCode = latestTeamId != null ? teamCodes.get(latestTeamId) ?? null : null

  // Replace the player's whole season so stat corrections and MLB ID fixes take
  // effect retroactively instead of piling up next to stale rows.
  await prisma.$transaction([
    prisma.playerGameLog.deleteMany({ where: { playerId: player.id, seasonYear } }),
    prisma.playerGameLog.createMany({
      data: rows.map((row) => ({
        playerId: player.id,
        seasonYear,
        gamePk: row.gamePk,
        gameDate: new Date(`${row.gameDate}T00:00:00.000Z`),
        teamId: row.teamId,
        homeRuns: row.homeRuns,
        atBats: row.atBats,
        totalBases: row.totalBases,
      })),
      skipDuplicates: true,
    }),
    // The club of his most recent game, so traded players show their new team.
    ...(latestTeamCode
      ? [prisma.player.update({ where: { id: player.id }, data: { mlbTeam: latestTeamCode } })]
      : []),
  ])

  return rows.length
}

/**
 * Pulls the full regular-season game log for every player in any of the given
 * seasons' player pools. Players without an MLB ID are skipped (and reported).
 */
export async function importGameLogs(seasonYear: number, seasonIds: string[]) {
  const pool = await prisma.seasonPlayerGroup.findMany({
    where: { seasonId: { in: seasonIds } },
    select: { player: { select: { id: true, providerPlayerId: true, fullName: true } } },
  })

  const byId = new Map<string, PlayerToImport>()
  const missingIds: string[] = []

  for (const { player } of pool) {
    if (player.providerPlayerId) {
      byId.set(player.id, { id: player.id, providerPlayerId: player.providerPlayerId })
    } else {
      missingIds.push(player.fullName)
    }
  }

  const teamCodes = await getTeamAbbreviations(seasonYear)
  const queue = [...byId.values()]
  const failures: string[] = []
  let games = 0

  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        const imported = await importOne(next, seasonYear, teamCodes)
        games += imported
      } catch (error) {
        failures.push(`${next.providerPlayerId}: ${error instanceof Error ? error.message : error}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  return { players: byId.size, games, missingIds: [...new Set(missingIds)], failures }
}

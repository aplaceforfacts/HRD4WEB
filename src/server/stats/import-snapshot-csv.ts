import { prisma } from "@/lib/prisma"

type SnapshotCSVRow = Record<string, string>

const PROVIDER_ID_COLUMNS = [
  "providerId",
  "providerPlayerId",
  "provider_player_id",
  "provider_id",
  "mlbId",
  "mlb_id",
  "mlbamId",
  "mlbam_id",
  "mlbam",
]

const INTERNAL_PLAYER_ID_COLUMNS = ["playerId"]
const GENERIC_PLAYER_ID_COLUMNS = ["player_id"]

const MAX_MUNCY_PROVIDER_ID_BY_TEAM = new Map([
  ["lad", "571970"],
  ["la", "571970"],
  ["dodgers", "571970"],
  ["los angeles dodgers", "571970"],
  ["as", "691777"],
  ["a's", "691777"],
  ["ath", "691777"],
  ["oak", "691777"],
  ["oakland", "691777"],
  ["athletics", "691777"],
  ["oakland athletics", "691777"],
])

function parseCSV(text: string) {
  const [header, ...rows] = text.trim().split("\n")
  const keys = header.split(",")

  return rows.map((row) => {
    const values = row.split(",")
    const obj: Record<string, string> = {}

    keys.forEach((key, i) => {
      obj[key.trim()] = values[i]?.trim() ?? ""
    })

    return obj
  })
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.’']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function firstPresent(row: SnapshotCSVRow, columns: string[]) {
  for (const column of columns) {
    const value = row[column]?.trim()
    if (value) return value
  }

  return null
}

async function findPlayerByProviderId(providerPlayerId: string) {
  return prisma.player.findUnique({
    where: { providerPlayerId },
    select: { id: true, fullName: true },
  })
}

async function resolveSnapshotPlayer(row: SnapshotCSVRow, seasonId: string) {
  const internalPlayerId = firstPresent(row, INTERNAL_PLAYER_ID_COLUMNS)
  if (internalPlayerId?.startsWith("c")) {
    const player = await prisma.player.findUnique({
      where: { id: internalPlayerId },
      select: { id: true, fullName: true },
    })
    if (player) return player
  }

  const providerPlayerId = firstPresent(row, PROVIDER_ID_COLUMNS)
  if (providerPlayerId) {
    const player = await findPlayerByProviderId(providerPlayerId)
    if (player) return player

    console.warn(`Player not found for provider ID ${providerPlayerId}: ${row.player_name}`)
    return null
  }

  const genericPlayerId = firstPresent(row, GENERIC_PLAYER_ID_COLUMNS)
  if (genericPlayerId) {
    const player = await findPlayerByProviderId(genericPlayerId)
    if (player) return player

    console.warn(
      `Generic player_id did not match a provider ID; falling back to disambiguation: ${genericPlayerId}`,
    )
  }

  const playerName = row.player_name?.trim()
  if (!playerName) {
    console.warn("Skipping CSV row without player_name")
    return null
  }

  const team = row.team?.trim()
  if (normalize(playerName) === "max muncy") {
    const maxMuncyProviderId = team ? MAX_MUNCY_PROVIDER_ID_BY_TEAM.get(normalize(team)) : null

    if (!maxMuncyProviderId) {
      console.warn(
        `Skipping ambiguous Max Muncy row without a usable team/provider ID: ${JSON.stringify(row)}`,
      )
      return null
    }

    const player = await findPlayerByProviderId(maxMuncyProviderId)
    if (player) return player

    console.warn(`Player not found for Max Muncy provider ID ${maxMuncyProviderId}`)
    return null
  }

  const candidates = await prisma.player.findMany({
    where: {
      fullName: playerName,
      seasonGroups: {
        some: { seasonId },
      },
    },
    select: {
      id: true,
      fullName: true,
      mlbTeam: true,
    },
  })

  const teamMatchedCandidates = team
    ? candidates.filter((player) => normalize(player.mlbTeam ?? "") === normalize(team))
    : candidates

  if (teamMatchedCandidates.length === 1) {
    const [player] = teamMatchedCandidates
    return { id: player.id, fullName: player.fullName }
  }

  console.warn(`Skipping ambiguous/no player match for ${playerName}${team ? ` (${team})` : ""}`)
  return null
}

export async function importSnapshotCSV(csvText: string, seasonYear = 2026) {
  const season = await prisma.season.findUnique({ where: { year: seasonYear } })
  if (!season) throw new Error("Season not found")

  const rows = parseCSV(csvText)

  for (const row of rows) {
    const player = await resolveSnapshotPlayer(row, season.id)

    if (!player) {
      console.warn(`Player not found: ${row.player_name}`)
      continue
    }

    const snapshotDate = new Date(row.snapshot_date)

    await prisma.playerStatSnapshot.upsert({
      where: {
        seasonId_playerId_snapshotDate: {
          seasonId: season.id,
          playerId: player.id,
          snapshotDate,
        },
      },
      update: {
        homeRuns: Number(row.home_runs || 0),
        atBats: row.at_bats ? Number(row.at_bats) : null,
        sluggingPct: row.slugging_pct ? Number(row.slugging_pct) : null,
        teamCode: row.team || null,
        sourceName: "csv-import",
      },
      create: {
        seasonId: season.id,
        playerId: player.id,
        snapshotDate,
        homeRuns: Number(row.home_runs || 0),
        atBats: row.at_bats ? Number(row.at_bats) : null,
        sluggingPct: row.slugging_pct ? Number(row.slugging_pct) : null,
        teamCode: row.team || null,
        sourceName: "csv-import",
      },
    })
  }

  return { imported: rows.length }
}

import { prisma } from "@/lib/prisma"

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

export async function importSnapshotCSV(csvText: string, seasonYear = 2026) {
  const season = await prisma.season.findUnique({ where: { year: seasonYear } })
  if (!season) throw new Error("Season not found")

  const rows = parseCSV(csvText)

  for (const row of rows) {
    const player = await prisma.player.findUnique({
      where: { fullName: row.player_name },
    })

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

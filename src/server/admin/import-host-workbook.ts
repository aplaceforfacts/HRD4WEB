import ExcelJS from "exceljs"
import { SubmissionMethod } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { playerNameKey, splitHostLabel } from "@/server/players/player-names"

/**
 * Loads a season from the league host's workbook:
 *   Players tab -> each group's player pool ("A." ... "L.", then "WILD CARDS")
 *   Picks tab   -> one team per row: Name, A. ... L., Wild Card #1..#n
 * Dry run by default. Existing pool rows and teams are left alone, so a later
 * workbook can be re-imported to add late teams.
 */

type ImportOptions = { commit: boolean; skipEntries?: boolean }

type PoolRow = { groupCode: string; label: string; name: string; team: string | null; displayOrder: number }

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ""
  if (typeof value === "object" && "result" in value) return String(value.result ?? "")
  if (typeof value === "object" && "richText" in value) return value.richText.map((part) => part.text).join("")
  return String(value)
}

function readPool(sheet: ExcelJS.Worksheet, multiGroupCode: string | null) {
  const rows: PoolRow[] = []
  let groupCode: string | null = null
  let order = 0

  sheet.eachRow((row) => {
    const label = cellText(row.getCell(1).value).trim()
    if (!label) return

    const header = label.match(/^([A-Z])\.$/)
    if (header) {
      groupCode = header[1]
      order = 0
      return
    }
    if (/^wild\s*cards?$/i.test(label)) {
      groupCode = multiGroupCode
      order = 0
      return
    }
    if (!groupCode) return

    const { name, team } = splitHostLabel(label)
    order += 1
    rows.push({ groupCode, label, name, team, displayOrder: order })
  })

  return rows
}

export async function importHostWorkbook(leagueSlug: string, year: number, file: Buffer, options: ImportOptions) {
  const season = await prisma.season.findFirst({
    where: { year, league: { slug: leagueSlug } },
    include: {
      groups: { orderBy: { sortOrder: "asc" } },
      seasonPlayerGroups: { include: { player: true, group: true } },
      entries: { select: { teamName: true } },
    },
  })
  if (!season) throw new Error(`League ${leagueSlug} has no ${year} season. Run scripts/setup-season.ts first.`)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(file as unknown as ArrayBuffer)
  const playersSheet = workbook.getWorksheet("Players")
  const picksSheet = workbook.getWorksheet("Picks")
  if (!playersSheet) throw new Error('The workbook has no "Players" tab.')

  const multiGroups = season.groups.filter((group) => group.selectionCount > 1)
  const groupByCode = new Map(season.groups.map((group) => [group.code, group]))
  const pool = readPool(playersSheet, multiGroups.length === 1 ? multiGroups[0].code : null)

  const unknownGroups = [...new Set(pool.map((row) => row.groupCode))].filter((code) => !groupByCode.has(code))
  if (unknownGroups.length) throw new Error(`The workbook has groups this season doesn't: ${unknownGroups.join(", ")}.`)

  // Resolve each pool label to a Player: already in this season's pool, else an
  // existing player with that name (team breaks ties), else a new player whose MLB
  // ID the nightly sync looks up.
  const allPlayers = await prisma.player.findMany({ select: { id: true, fullName: true, mlbTeam: true } })
  const playersByKey = new Map<string, typeof allPlayers>()
  for (const player of allPlayers) {
    const key = playerNameKey(player.fullName)
    playersByKey.set(key, [...(playersByKey.get(key) ?? []), player])
  }
  const seasonPoolByKey = new Map(season.seasonPlayerGroups.map((row) => [`${row.group.code}:${playerNameKey(row.player.fullName)}`, row.player]))

  const resolved = new Map<string, { playerId: string | null; row: PoolRow; action: "in-pool" | "existing-player" | "new-player" }>()
  for (const row of pool) {
    const key = playerNameKey(row.name)
    const inPool = seasonPoolByKey.get(`${row.groupCode}:${key}`)
    if (inPool) {
      resolved.set(row.label, { playerId: inPool.id, row, action: "in-pool" })
      continue
    }
    const candidates = playersByKey.get(key) ?? []
    const match = candidates.length === 1 ? candidates[0] : candidates.find((player) => player.mlbTeam === row.team)
    resolved.set(row.label, { playerId: match?.id ?? null, row, action: match ? "existing-player" : "new-player" })
  }

  // Picks: one team per row, columns in group order (multi-pick groups take n columns).
  const slotGroups = season.groups.flatMap((group) => Array.from({ length: group.selectionCount }, () => group.code))
  const existingTeams = new Set(season.entries.map((entry) => entry.teamName.trim().toLowerCase()))
  const teams: Array<{ teamName: string; picks: Array<{ groupCode: string; label: string }> }> = []
  const badTeams: string[] = []

  if (picksSheet && !options.skipEntries) {
    picksSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const teamName = cellText(row.getCell(1).value).trim()
      if (!teamName) return
      const picks = slotGroups.map((groupCode, index) => ({ groupCode, label: cellText(row.getCell(index + 2).value).trim() }))
      const missing = picks.filter((pick) => !pick.label || !resolved.has(pick.label))
      if (missing.length) {
        badTeams.push(`${teamName}: ${missing.map((pick) => pick.label || `(blank ${pick.groupCode})`).join(", ")}`)
        return
      }
      teams.push({ teamName, picks })
    })
  }

  const newTeams = teams.filter((team) => !existingTeams.has(team.teamName.toLowerCase()))
  const summary = {
    league: leagueSlug,
    year,
    mode: options.commit ? "commit" : "dry-run",
    poolRows: pool.length,
    alreadyInPool: [...resolved.values()].filter((value) => value.action === "in-pool").length,
    addingExistingPlayers: [...resolved.values()].filter((value) => value.action === "existing-player").map((value) => value.row.label),
    creatingNewPlayers: [...resolved.values()].filter((value) => value.action === "new-player").map((value) => value.row.label),
    teamsInWorkbook: teams.length + badTeams.length,
    teamsAlreadyInApp: teams.length - newTeams.length,
    teamsToCreate: newTeams.map((team) => team.teamName),
    teamsWithUnknownPicks: badTeams,
  }

  if (!options.commit) return summary

  for (const value of resolved.values()) {
    if (value.action === "in-pool") continue
    const group = groupByCode.get(value.row.groupCode)!
    const playerId =
      value.playerId ??
      (await prisma.player.create({ data: { fullName: value.row.name, mlbTeam: value.row.team, isActive: true } })).id
    value.playerId = playerId
    await prisma.seasonPlayerGroup.upsert({
      where: { seasonId_playerId: { seasonId: season.id, playerId } },
      update: {},
      create: { seasonId: season.id, groupId: group.id, playerId, displayOrder: value.row.displayOrder },
    })
  }

  for (const team of newTeams) {
    const placeholder = `import-${leagueSlug}-${year}-${team.teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@example.local`
    const owner = await prisma.owner.upsert({
      where: { email: placeholder },
      update: {},
      create: { name: team.teamName, email: placeholder },
    })
    const slots = new Map<string, number>()
    await prisma.entry.create({
      data: {
        seasonId: season.id,
        ownerId: owner.id,
        teamName: team.teamName,
        submissionMethod: SubmissionMethod.IMPORTED,
        submittedAt: new Date(),
        isLocked: true,
        lockedAt: new Date(),
        paymentNote: "Imported from the host workbook",
        players: {
          create: team.picks.map((pick) => {
            const slotNumber = (slots.get(pick.groupCode) ?? 0) + 1
            slots.set(pick.groupCode, slotNumber)
            return {
              groupId: groupByCode.get(pick.groupCode)!.id,
              playerId: resolved.get(pick.label)!.playerId!,
              slotNumber,
            }
          }),
        },
      },
    })
  }

  return summary
}

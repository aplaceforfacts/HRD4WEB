import ExcelJS from "exceljs"
import { prisma } from "@/lib/prisma"

/**
 * The league host's monthly workbook, rebuilt from the app's data:
 *   General-Prizes · Players · Picks · one tab per completed month · YTD
 * Months after the export period are left blank, as they are in the host's file.
 */

const MONTH_ABBREVIATIONS: Record<string, string> = {
  january: "JAN", february: "FEB", march: "MAR", april: "APR", may: "MAY", june: "JUN",
  july: "JUL", august: "AUG", september: "SEP", october: "OCT", november: "NOV", december: "DEC",
  jan: "JAN", feb: "FEB", mar: "MAR", apr: "APR", jun: "JUN", jul: "JUL", aug: "AUG", sep: "SEP", oct: "OCT",
}

/** "Mar/Apr" -> "MAR-APR", "June" -> "JUN" (the Players tab's column headers). */
function columnHeader(label: string) {
  return label
    .split("/")
    .map((part) => MONTH_ABBREVIATIONS[part.trim().toLowerCase()] ?? part.toUpperCase())
    .join("-")
}

/** "Mar/Apr" -> "MarApr" (sheet names can't contain "/"). */
function sheetName(label: string) {
  return label.replace(/[\\/?*[\]:]/g, "").slice(0, 31)
}

export type WorkbookPeriod = { id: string; label: string; sortOrder: number }

export async function buildStandingsWorkbook(seasonId: string, throughPeriodId: string) {
  const season = await prisma.season.findUniqueOrThrow({
    where: { id: seasonId },
    include: {
      league: true,
      scoringPeriods: { orderBy: { sortOrder: "asc" } },
      groups: {
        orderBy: { sortOrder: "asc" },
        include: { seasonPlayers: { include: { player: true } } },
      },
    },
  })

  const through = season.scoringPeriods.find((period) => period.id === throughPeriodId)
  if (!through) throw new Error("Export period is not part of this season.")

  const monthly = season.scoringPeriods.filter((period) => period.periodType === "MONTHLY")
  const seasonPeriod = season.scoringPeriods.find((period) => period.periodType === "SEASON")
  const throughMonthly = through.periodType === "SEASON" ? monthly : monthly.filter((period) => period.sortOrder <= through.sortOrder)
  const includedIds = new Set(throughMonthly.map((period) => period.id))

  const [entries, playerStats, entryScores] = await Promise.all([
    prisma.entry.findMany({
      where: { seasonId },
      include: { players: { include: { group: true, player: true } } },
      orderBy: { teamName: "asc" },
    }),
    prisma.playerPeriodStat.findMany({
      where: { seasonId, scoringPeriodId: { in: [...includedIds] } },
      select: { playerId: true, scoringPeriodId: true, homeRuns: true },
    }),
    prisma.entryPeriodScore.findMany({
      where: { seasonId, scoringPeriodId: { in: [...includedIds] } },
      select: { entryId: true, scoringPeriodId: true, homeRuns: true },
    }),
  ])

  const playerMonth = new Map(playerStats.map((row) => [`${row.playerId}:${row.scoringPeriodId}`, row.homeRuns]))
  const entryMonth = new Map(entryScores.map((row) => [`${row.entryId}:${row.scoringPeriodId}`, row.homeRuns]))
  const pickedIds = new Set(entries.flatMap((entry) => entry.players.map((row) => row.playerId)))
  // Label players with the team on this season's sheet, not wherever they play now.
  const seasonTeam = new Map(
    season.groups.flatMap((group) => group.seasonPlayers.map((sp) => [sp.playerId, sp.teamCode] as const)),
  )
  const playerLabel = (player: { id: string; fullName: string; mlbTeam: string | null }) => {
    const team = seasonTeam.get(player.id) ?? player.mlbTeam
    return team ? `${player.fullName} ${team}` : player.fullName
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = season.league.name
  workbook.created = new Date()

  // General-Prizes
  const prizes = workbook.addWorksheet("General-Prizes")
  prizes.getColumn(1).width = 48
  const prizeLines = (season.prizesText ?? `Welcome to the ${season.year} ${season.league.name}!`).split("\n")
  prizeLines.forEach((line, index) => {
    const cell = prizes.getCell(index + 1, 1)
    cell.value = line || null
    cell.font = index === 0 ? { size: 20 } : { size: 18, bold: true }
  })

  // Players: one block per group; single-pick groups list their whole pool, the
  // multi-pick group lists the players at least one team took.
  const players = workbook.addWorksheet("Players")
  const monthCols = monthly.map((_, index) => index + 2)
  const totalCol = monthly.length + 3
  players.getColumn(1).width = 30
  monthCols.forEach((col) => (players.getColumn(col).width = 12))
  players.getColumn(totalCol - 1).width = 2
  players.getColumn(totalCol).width = 14

  let row = 1
  for (const group of season.groups) {
    const isMulti = group.selectionCount > 1
    const pool = group.seasonPlayers
      .map((sp) => sp.player)
      .filter((player) => !isMulti || pickedIds.has(player.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))

    const header = players.getRow(row)
    if (isMulti) {
      header.getCell(1).value = "WILD CARDS"
    } else {
      header.getCell(1).value = `${group.code}.`
      header.getCell(1).font = { bold: true, size: 12 }
      row += 1
    }

    const columns = players.getRow(row)
    monthly.forEach((period, index) => {
      const cell = columns.getCell(monthCols[index])
      cell.value = columnHeader(period.label)
    })
    columns.getCell(totalCol).value = "TOTAL"
    if (isMulti) columns.getCell(1).value = "WILD CARDS"
    columns.eachCell((cell) => {
      cell.font = { bold: true, size: 14 }
      cell.alignment = { horizontal: "center" }
    })
    columns.getCell(1).alignment = { horizontal: "left" }
    row += 1

    const firstPlayerRow = row
    for (const player of pool) {
      const line = players.getRow(row)
      line.getCell(1).value = playerLabel(player)
      let total = 0
      monthly.forEach((period, index) => {
        if (!includedIds.has(period.id)) return
        const value = playerMonth.get(`${player.id}:${period.id}`) ?? 0
        total += value
        line.getCell(monthCols[index]).value = value
      })
      const first = players.getColumn(monthCols[0]).letter
      const last = players.getColumn(monthCols[monthCols.length - 1]).letter
      line.getCell(totalCol).value = { formula: `SUM(${first}${row}:${last}${row})`, result: total }
      line.getCell(totalCol).font = { bold: true }
      line.getCell(totalCol).alignment = { horizontal: "center" }
      row += 1
    }

    if (pool.length > 0) {
      const totals = players.getRow(row)
      monthly.forEach((period, index) => {
        if (!includedIds.has(period.id)) return
        const letter = players.getColumn(monthCols[index]).letter
        const result = pool.reduce((sum, player) => sum + (playerMonth.get(`${player.id}:${period.id}`) ?? 0), 0)
        totals.getCell(monthCols[index]).value = { formula: `SUM(${letter}${firstPlayerRow}:${letter}${row - 1})`, result }
      })
      totals.font = { bold: true }
      row += 1
    }
    row += 1
  }

  // Picks: one row per team with every pick and the team's month and YTD totals.
  const picks = workbook.addWorksheet("Picks", { views: [{ state: "frozen", ySplit: 1 }] })
  const pickHeaders: string[] = []
  const slotGroups: Array<{ groupId: string; slot: number }> = []
  for (const group of season.groups) {
    for (let slot = 1; slot <= group.selectionCount; slot += 1) {
      pickHeaders.push(group.selectionCount > 1 ? `Wild Card #${slot}` : `${group.code}.`)
      slotGroups.push({ groupId: group.id, slot })
    }
  }
  const pickHeaderRow = ["Name", ...pickHeaders, ...monthly.map((period) => period.label), "YTD"]
  picks.addRow(pickHeaderRow).font = { bold: true }
  picks.getColumn(1).width = 28
  for (let col = 2; col <= pickHeaders.length + 1; col += 1) picks.getColumn(col).width = 24
  for (let col = pickHeaders.length + 2; col <= pickHeaderRow.length; col += 1) picks.getColumn(col).width = 10

  const ytdByEntry = new Map<string, number>()
  for (const entry of entries) {
    const byGroup = new Map<string, typeof entry.players>()
    for (const pick of entry.players) {
      byGroup.set(pick.groupId, [...(byGroup.get(pick.groupId) ?? []), pick])
    }
    for (const list of byGroup.values()) list.sort((a, b) => a.slotNumber - b.slotNumber)

    const pickCells = slotGroups.map(({ groupId, slot }) => {
      const pick = byGroup.get(groupId)?.[slot - 1]
      return pick ? playerLabel(pick.player) : null
    })
    const monthCells = monthly.map((period) =>
      includedIds.has(period.id) ? entryMonth.get(`${entry.id}:${period.id}`) ?? 0 : null,
    )
    const ytd = monthCells.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    ytdByEntry.set(entry.id, ytd)
    picks.addRow([entry.teamName, ...pickCells, ...monthCells, ytd])
  }

  // One standings tab per completed month, then YTD, each sorted high to low.
  const standingsTab = (name: string, header: string, value: (entryId: string) => number) => {
    const sheet = workbook.addWorksheet(name)
    sheet.addRow(["Name", header]).font = { bold: true }
    sheet.getColumn(1).width = 30
    sheet.getColumn(2).width = 14
    const rows = entries
      .map((entry) => ({ name: entry.teamName, value: value(entry.id) }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    for (const item of rows) sheet.addRow([item.name, item.value])
  }

  for (const period of throughMonthly) {
    standingsTab(sheetName(period.label), period.label, (entryId) => entryMonth.get(`${entryId}:${period.id}`) ?? 0)
  }
  standingsTab("YTD", "YTD", (entryId) => ytdByEntry.get(entryId) ?? 0)

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  const lastLabel = through.periodType === "SEASON" ? "Final" : through.label.replace("/", "-")
  const fileName = `${season.year} ${season.league.name} - ${lastLabel}.xlsx`

  return {
    buffer,
    fileName,
    season: { id: season.id, year: season.year, name: season.name, leagueName: season.league.name, leagueSlug: season.league.slug },
    period: through,
    isFinalPeriod: seasonPeriod ? throughMonthly.length === monthly.length : false,
  }
}

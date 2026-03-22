import fs from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type CsvRow = Record<string, string>

function detectDelimiter(line: string) {
  const commaCount = (line.match(/,/g) ?? []).length
  const semicolonCount = (line.match(/;/g) ?? []).length
  return semicolonCount > commaCount ? ";" : ","
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      result.push(current)
      current = ""
      continue
    }

    current += char
  }

  result.push(current)
  return result.map((value) => value.trim())
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])
  const headers = parseDelimitedLine(lines[0], delimiter)

  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter)
    const row: CsvRow = {}

    headers.forEach((header, index) => {
      row[header] = values[index] ?? ""
    })

    return row
  })
}

function getField(row: CsvRow, candidates: string[]) {
  for (const key of candidates) {
    if (row[key] != null && row[key] !== "") return row[key]
  }
  return ""
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null
  const cleaned = value.replace(/,/g, "").trim()
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'"]/g, "")
    .replace(/\b(jr|sr)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

const NAME_MATCH_OVERRIDES: Record<string, string> = {
  "eugenio suarez": "eugenio suarez",
  "ronald acuna jr": "ronald acuna jr",
  "teoscar hernandez": "teoscar hernandez",
  "yandy diaz": "yandy diaz",
  "ramon laureano": "ramon laureano",
  "jose ramirez": "jose ramirez",
  "agustin ramirez": "agustin ramirez",
  "adolis garcia": "adolis garcia",
  "ivan herrera": "ivan herrera",
  "gary sanchez": "gary sanchez",
  "andres chaparro": "andres chaparro",
  "andres gimenez": "andres gimenez",
  "heriberto hernandez": "heriberto hernandez",
  "javier baez": "javier baez",
  "eloy jimenez": "eloy jimenez",
  "carlos narvaez": "carlos narvaez",
  "jeremy pena": "jeremy pena",
  "enrique hernandez": "enrique hernandez",
  "jesus sanchez": "jesus sanchez",
  "nelson velazquez": "nelson velazquez",
  "wenceel perez": "wenceel perez",
  "yoan moncada": "yoan moncada",
  "moises ballesteros": "moises ballesteros",
  "ramon urias": "ramon urias",
  "luisangel acuna": "luisangel acuna",
  "jasson dominguez": "jasson dominguez",
  "yainer diaz": "yainer diaz",
  "pedro pages": "pedro pages",
  "pedro pages ": "pedro pages",
}

async function main() {
  const csvPath = path.join(process.cwd(), "src", "data", "steamer-2026-hitters.csv")

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found at ${csvPath}`)
  }

  const content = fs.readFileSync(csvPath, "utf8")
  const rows = parseCsv(content)

  if (rows.length === 0) {
    throw new Error("No rows found in CSV")
  }

  console.log(`Loaded ${rows.length} CSV rows`)

  const players = await prisma.player.findMany({
    select: {
      id: true,
      fullName: true,
      providerPlayerId: true,
    },
  })

  const playersByProviderId = new Map<string, { id: string; fullName: string }>()
  const playersByName = new Map<string, { id: string; fullName: string }>()

  for (const player of players) {
    if (player.providerPlayerId) {
      playersByProviderId.set(String(player.providerPlayerId), {
        id: player.id,
        fullName: player.fullName,
      })
    }

    playersByName.set(normalizeName(player.fullName), {
      id: player.id,
      fullName: player.fullName,
    })
  }

  let imported = 0
  let skipped = 0

  for (const row of rows) {
    const rawName = getField(row, [
      "Name",
      "PLAYERNAME",
      "Player",
      "Player Name",
      "playername",
    ])

    const rawRazzId = getField(row, [
      "RazzID",
      "razzid",
      "MLBID",
      "mlbid",
      "playerid",
    ])

    const projectedAtBats = toNumber(getField(row, ["AB", "ab"]))
    const projectedHomeRuns = toNumber(getField(row, ["HR", "hr"]))
    const projectedSluggingPct = toNumber(getField(row, ["SLG", "slg"]))

    if (!rawName) {
      skipped += 1
      console.warn("Skipped row with no Name")
      continue
    }

    let matchedPlayer: { id: string; fullName: string } | undefined

    if (rawRazzId && playersByProviderId.has(String(rawRazzId))) {
      matchedPlayer = playersByProviderId.get(String(rawRazzId))
    }

    if (!matchedPlayer) {
      const normalizedCsvName = NAME_MATCH_OVERRIDES[normalizeName(rawName)] ?? normalizeName(rawName)
      matchedPlayer = playersByName.get(normalizedCsvName)
    }

    if (!matchedPlayer) {
      skipped += 1
      console.warn(`No player match for projection row: ${rawName}`)
      continue
    }

    await prisma.playerProjection.upsert({
      where: {
        playerId_seasonYear_source: {
          playerId: matchedPlayer.id,
          seasonYear: 2026,
          source: "steamer",
        },
      },
      update: {
        projectedHomeRuns,
        projectedAtBats,
        projectedSluggingPct,
        importedAt: new Date(),
      },
      create: {
        playerId: matchedPlayer.id,
        seasonYear: 2026,
        source: "steamer",
        projectedHomeRuns,
        projectedAtBats,
        projectedSluggingPct,
        importedAt: new Date(),
      },
    })

    imported += 1
  }

  console.log(`Imported projections: ${imported}`)
  console.log(`Skipped rows: ${skipped}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
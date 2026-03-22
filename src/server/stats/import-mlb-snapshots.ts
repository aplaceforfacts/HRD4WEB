import { prisma } from "@/lib/prisma"
import { getPlayerSeasonStats, searchMlbPlayerByName } from "./mlb-stats-api"

type MatchResult = {
  playerId: string
  fullName: string
  providerPlayerId: string | null
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'"]/g, "")
    .replace(/\b(jr|sr)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

const NAME_OVERRIDES: Record<string, string> = {
  "Eugenio Suárez": "Eugenio Suarez",
  "Ronald Acuna Jr.": "Ronald Acuña Jr.",
  "Teoscar Hernandez": "Teoscar Hernández",
  "Yandy Diaz": "Yandy Díaz",
  "Ramon Laureano": "Ramón Laureano",
  "Jose Ramirez": "José Ramírez",
  "Agustin Ramirez": "Agustín Ramírez",
  "Adolis Garcia": "Adolis García",
  "Ivan Herrera": "Iván Herrera",
  "Gary Sanchez": "Gary Sánchez",
  "Andres Chaparro": "Andrés Chaparro",
  "Andres Gimenez": "Andrés Giménez",
  "Heriberto Hernandez": "Heriberto Hernández",
  "Javier Baez": "Javier Báez",
  "Eloy Jimenez": "Eloy Jiménez",
  "Carlos Narvaez": "Carlos Narváez",
  "Jeremy Pena": "Jeremy Peña",
  "Enrique Hernandez": "Enrique Hernández",
  "Jesus Sanchez": "Jesús Sánchez",
  "Nelson Velazquez": "Nelson Velázquez",
  "Wenceel Perez": "Wenceel Pérez",
  "Yoan Moncada": "Yoán Moncada",
  "Angel Martinez": "Angel Martínez",
  "Moises Ballesteros": "Moisés Ballesteros",
  "Ramon Urias": "Ramón Urías",
  "Luisangel Acuna": "Luisangel Acuña",
}

const PROVIDER_ID_OVERRIDES: Record<string, string> = {
  "Will Smith": "669257",
  "José Ramírez": "608070",
  "Jose Ramirez": "608070",
  "Josh Bell": "605137",
  "Sean Murphy": "669221",
  "Luis García": "671277",
  "Luis Garcia": "671277",
  "Gabriel Arias": "672356",
  "Jacob Wilson": "805779",
  "Joe Mack": "805734",
  "Luis Matos": "682641",
  "JT Realmuto": "592663",
  "JP Crawford": "641487",
  "Julio Rodríguez": "677594",
  "Julio Rodriguez": "677594",
  "Jesús Sánchez": "660821",
  "Jesus Sanchez": "660821",
  "Max Muncy": "571970",
  "Pedro Pagés": "691912",
  "Pedro Pages": "691912",
  "Gio Urshela": "570482",
  "Giovanny Urshela": "570482",
  "Casey Schmitt": "669477",
  "Casey Schmidt": "669477",
  "Zach Dezenzo": "700270",
  "Zack Dezenzo": "700270",
  "Christian Coss": "683766",
  "Sung Mun Song": "823550",
}

function isPlaceholder(name: string) {
  return (
    name.startsWith("Top Prospect") ||
    name.startsWith("Rookie") ||
    name === "Any other MLB player"
  )
}

async function ensureProviderIds(): Promise<MatchResult[]> {
  const players = await prisma.player.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fullName: true,
      providerPlayerId: true,
    },
  })

  const matched: MatchResult[] = []

  for (const player of players) {
    if (player.providerPlayerId) {
      matched.push({
        playerId: player.id,
        fullName: player.fullName,
        providerPlayerId: player.providerPlayerId,
      })
      continue
    }

    if (isPlaceholder(player.fullName)) {
      console.warn(`Skipping placeholder: ${player.fullName}`)
      matched.push({
        playerId: player.id,
        fullName: player.fullName,
        providerPlayerId: null,
      })
      continue
    }

    const overrideId = PROVIDER_ID_OVERRIDES[player.fullName]
    if (overrideId) {
      const existing = await prisma.player.findFirst({
        where: { providerPlayerId: overrideId },
        select: { fullName: true },
      })

      if (!existing) {
        await prisma.player.update({
          where: { id: player.id },
          data: { providerPlayerId: overrideId },
        })

        matched.push({
          playerId: player.id,
          fullName: player.fullName,
          providerPlayerId: overrideId,
        })
        continue
      }

      if (existing.fullName === player.fullName) {
        matched.push({
          playerId: player.id,
          fullName: player.fullName,
          providerPlayerId: overrideId,
        })
        continue
      }
    }

    const searchName = NAME_OVERRIDES[player.fullName] ?? player.fullName
    const results = await searchMlbPlayerByName(searchName)
    const normalizedLocal = normalize(searchName)

    const exactMatches = results.filter(
      (r) => normalize(r.fullName) === normalizedLocal
    )

    if (exactMatches.length !== 1) {
      console.warn(
        `Skipping ambiguous/no match for ${player.fullName}. Matches: ${results
          .map((r) => r.fullName)
          .join(", ")}`
      )

      matched.push({
        playerId: player.id,
        fullName: player.fullName,
        providerPlayerId: null,
      })
      continue
    }

    const best = exactMatches[0]

    const existing = await prisma.player.findFirst({
      where: { providerPlayerId: String(best.id) },
      select: { fullName: true },
    })

    if (existing) {
      console.warn(
        `Skipping ${player.fullName}: MLB ID already assigned to ${existing.fullName}`
      )

      matched.push({
        playerId: player.id,
        fullName: player.fullName,
        providerPlayerId: null,
      })
      continue
    }

    await prisma.player.update({
      where: { id: player.id },
      data: {
        providerPlayerId: String(best.id),
      },
    })

    matched.push({
      playerId: player.id,
      fullName: player.fullName,
      providerPlayerId: String(best.id),
    })
  }

  return matched
}

export async function importMlbSnapshotsForToday(seasonYear = 2026) {
  const season = await prisma.season.findUnique({
    where: { year: seasonYear },
  })

  if (!season) throw new Error(`Season ${seasonYear} not found`)

  const matchedPlayers = await ensureProviderIds()
  const snapshotDate = new Date()

  let imported = 0

  for (const row of matchedPlayers) {
    if (!row.providerPlayerId) continue

    const stats = await getPlayerSeasonStats(Number(row.providerPlayerId), seasonYear)

    await prisma.playerStatSnapshot.upsert({
      where: {
        seasonId_playerId_snapshotDate: {
          seasonId: season.id,
          playerId: row.playerId,
          snapshotDate,
        },
      },
      update: {
        homeRuns: stats.homeRuns,
        atBats: stats.atBats,
        sluggingPct: stats.sluggingPct,
        teamCode: stats.teamCode,
        sourceName: "mlb-stats-api",
      },
      create: {
        seasonId: season.id,
        playerId: row.playerId,
        snapshotDate,
        homeRuns: stats.homeRuns,
        atBats: stats.atBats,
        sluggingPct: stats.sluggingPct,
        teamCode: stats.teamCode,
        sourceName: "mlb-stats-api",
      },
    })

    imported += 1
  }

  return { imported }
}
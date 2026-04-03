import { PrismaClient } from "@prisma/client"
import { getPlayerSeasonSnapshot } from "../src/server/stats/mlb-stats-api"

const prisma = new PrismaClient()

async function backfillSeasonStats(seasonYear: number) {
  const players = await prisma.player.findMany({
    where: {
      providerPlayerId: {
        not: null,
      },
    },
    select: {
      id: true,
      fullName: true,
      providerPlayerId: true,
    },
  })

  let imported = 0
  let skipped = 0

  for (const player of players) {
    if (!player.providerPlayerId) {
      skipped += 1
      continue
    }

    try {
      const stats = await getPlayerSeasonSnapshot(
        Number(player.providerPlayerId),
        seasonYear,
      )

      await prisma.historicalPlayerStat.upsert({
        where: {
          playerId_seasonYear: {
            playerId: player.id,
            seasonYear,
          },
        },
        update: {
          homeRuns: stats.homeRuns ?? 0,
          atBats: stats.atBats ?? null,
          sluggingPct: stats.sluggingPct ?? null,
        },
        create: {
          playerId: player.id,
          seasonYear,
          homeRuns: stats.homeRuns ?? 0,
          atBats: stats.atBats ?? null,
          sluggingPct: stats.sluggingPct ?? null,
        },
      })

      imported += 1
      console.log(`Imported ${seasonYear}: ${player.fullName}`)
    } catch (error) {
      skipped += 1
      console.warn(`Skipped ${seasonYear}: ${player.fullName}`, error)
    }
  }

  return { seasonYear, imported, skipped }
}

async function main() {
  const seasons = [2024, 2025]
  const results = []

  for (const seasonYear of seasons) {
    results.push(await backfillSeasonStats(seasonYear))
  }

  console.log("Backfill complete")
  console.table(results)
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
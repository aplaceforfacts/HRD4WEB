import { PrismaClient } from "@prisma/client"
import { season2026PlayerSheet } from "../src/data/season-2026-player-sheet"

const prisma = new PrismaClient()

async function main() {
  const season = await prisma.season.findUnique({ where: { year: 2026 } })
  if (!season) throw new Error("2026 season not found. Run prisma/seed.ts first.")

  const groups = await prisma.group.findMany({
    where: { seasonId: season.id },
    select: { id: true, code: true },
  })

  const groupIdByCode = new Map(groups.map((group) => [group.code, group.id]))

  for (const row of season2026PlayerSheet) {
    const groupId = groupIdByCode.get(row.groupCode)
    if (!groupId) throw new Error(`Group ${row.groupCode} not found for season 2026.`)

    const player = await prisma.player.upsert({
      where: { fullName: row.fullName },
      update: {
        mlbTeam: row.team,
        isActive: true,
      },
      create: {
        fullName: row.fullName,
        mlbTeam: row.team,
        isActive: true,
      },
    })

    await prisma.seasonPlayerGroup.upsert({
      where: {
        seasonId_playerId: {
          seasonId: season.id,
          playerId: player.id,
        },
      },
      update: {
        groupId,
        displayOrder: row.displayOrder,
        notes: row.notes,
      },
      create: {
        seasonId: season.id,
        groupId,
        playerId: player.id,
        displayOrder: row.displayOrder,
        notes: row.notes,
      },
    })
  }

  console.log(`Imported ${season2026PlayerSheet.length} rows for 2026.`)
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })

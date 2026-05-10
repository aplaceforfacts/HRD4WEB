import { PrismaClient, ScoringPeriodType, SeasonStatus } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const season = await prisma.season.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      name: "Home Run Derby 2026",
      entryDeadlineAt: new Date("2026-03-24T23:59:59.999Z"),
      regularSeasonStart: new Date("2026-03-25T00:00:00.000Z"),
      regularSeasonEnd: new Date("2026-10-01T23:59:59.999Z"),
      entryStatus: SeasonStatus.LOCKED,
    },
  })

  const groups = [
    ["A", 1], ["B", 1], ["C", 1], ["D", 1], ["E", 1], ["F", 1],
    ["G", 1], ["H", 1], ["I", 1], ["J", 1], ["K", 1], ["L", 1], ["M", 4],
  ] as const

  for (const [index, [code, selectionCount]] of groups.entries()) {
    await prisma.group.upsert({
      where: { seasonId_code: { seasonId: season.id, code } },
      update: {},
      create: {
        seasonId: season.id,
        code,
        name: `Group ${code}`,
        selectionCount,
        sortOrder: index + 1,
      },
    })
  }

  const periods = [
    ["Mar/Apr", "2026-03-25T04:00:00.000Z", "2026-05-01T10:00:00.000Z", 1, ScoringPeriodType.MONTHLY],
    ["May", "2026-05-01T10:00:00.000Z", "2026-06-01T10:00:00.000Z", 2, ScoringPeriodType.MONTHLY],
    ["June", "2026-06-01T10:00:00.000Z", "2026-07-01T10:00:00.000Z", 3, ScoringPeriodType.MONTHLY],
    ["July", "2026-07-01T10:00:00.000Z", "2026-08-01T10:00:00.000Z", 4, ScoringPeriodType.MONTHLY],
    ["August", "2026-08-01T10:00:00.000Z", "2026-09-01T10:00:00.000Z", 5, ScoringPeriodType.MONTHLY],
    ["September", "2026-09-01T10:00:00.000Z", "2026-10-01T10:00:00.000Z", 6, ScoringPeriodType.MONTHLY],
    ["Season", "2026-03-25T04:00:00.000Z", "2026-10-01T10:00:00.000Z", 7, ScoringPeriodType.SEASON],
  ] as const

  for (const [label, startDate, endDate, sortOrder, periodType] of periods) {
    await prisma.scoringPeriod.upsert({
      where: { seasonId_label: { seasonId: season.id, label } },
      update: {},
      create: {
        seasonId: season.id,
        label,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        sortOrder,
        periodType,
      },
    })
  }

  console.log(`Seeded ${season.name}`)
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })

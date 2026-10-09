import fs from "node:fs"
import { PrismaClient } from "@prisma/client"
import { buildStandingsWorkbook } from "../src/server/export/build-standings-workbook"

// Usage: npx tsx scripts/export-workbook.ts <leagueSlug> <year> <periodLabel|Season> <out.xlsx>
async function main() {
  const [leagueSlug, year, periodLabel, out] = process.argv.slice(2)
  if (!leagueSlug || !year || !periodLabel || !out) {
    throw new Error("Usage: npx tsx scripts/export-workbook.ts <leagueSlug> <year> <periodLabel|Season> <out.xlsx>")
  }

  const prisma = new PrismaClient()
  const period = await prisma.scoringPeriod.findFirstOrThrow({
    where: { label: periodLabel, season: { year: Number(year), league: { slug: leagueSlug } } },
  })
  await prisma.$disconnect()

  const result = await buildStandingsWorkbook(period.seasonId, period.id)
  fs.writeFileSync(out, result.buffer)
  console.log(`Wrote ${result.fileName} -> ${out} (${result.buffer.length} bytes)`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

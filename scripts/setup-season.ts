import { setupSeason } from "../src/server/season/setup-season"

// Usage:
//   npx tsx scripts/setup-season.ts <leagueSlug> <year> ["League Name"]
// Examples:
//   npx tsx scripts/setup-season.ts hrd 2027
//   npx tsx scripts/setup-season.ts office-derby 2027 "Office Home Run Derby"
// Then load the player pool and entries with scripts/import-host-workbook.ts.
async function main() {
  const [leagueSlug, yearArg, leagueName] = process.argv.slice(2)
  const year = Number(yearArg)
  if (!leagueSlug || !Number.isInteger(year)) {
    throw new Error('Usage: npx tsx scripts/setup-season.ts <leagueSlug> <year> ["League Name"]')
  }

  const result = await setupSeason({ leagueSlug, year, leagueName })
  console.log(
    `${result.league.name} ${result.season.year}: ${result.groups} groups, periods ${result.periods.join(", ")}. ` +
      `Entries are ${result.season.entryStatus.toLowerCase()}.`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })

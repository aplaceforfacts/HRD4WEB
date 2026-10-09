import { setupSeason } from "../src/server/season/setup-season"

// Local development seed: one league with the current MLB season set up.
// Production seasons are created with scripts/setup-season.ts.
async function main() {
  const year = Number(process.env.SEED_YEAR ?? new Date().getFullYear())
  const result = await setupSeason({ leagueSlug: "hrd", leagueName: "Home Run Derby", year })
  console.log(`Seeded ${result.league.name} ${result.season.year} (${result.periods.join(", ")})`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

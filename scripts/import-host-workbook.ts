import fs from "node:fs"
import { importHostWorkbook } from "../src/server/admin/import-host-workbook"

// Usage: npx tsx scripts/import-host-workbook.ts <leagueSlug> <year> <workbook.xlsx> [--commit] [--pool-only]
// Without --commit it only reports what it would add. New teams get placeholder
// owner emails; add the real ones on the admin season page.
async function main() {
  const args = process.argv.slice(2)
  const [leagueSlug, yearArg, file] = args.filter((arg) => !arg.startsWith("--"))
  if (!leagueSlug || !yearArg || !file) {
    throw new Error("Usage: npx tsx scripts/import-host-workbook.ts <leagueSlug> <year> <workbook.xlsx> [--commit] [--pool-only]")
  }

  const summary = await importHostWorkbook(leagueSlug, Number(yearArg), fs.readFileSync(file), {
    commit: args.includes("--commit"),
    skipEntries: args.includes("--pool-only"),
  })
  console.log(JSON.stringify(summary, null, 2))
  if (!args.includes("--commit")) console.log("\nDry run only. Re-run with --commit to write.")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })

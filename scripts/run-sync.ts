import { runDailySync } from "../src/server/stats/run-daily-sync"

// Usage: npx tsx scripts/run-sync.ts <seasonYear>
// Runs the same pipeline as the nightly cron against whatever DATABASE_URL points at.
async function main() {
  const year = Number(process.argv[2])
  if (!Number.isInteger(year)) throw new Error("Usage: npx tsx scripts/run-sync.ts <seasonYear>")

  const started = Date.now()
  const result = await runDailySync(year)
  console.log(JSON.stringify(result, null, 2))
  console.log(`Finished in ${Math.round((Date.now() - started) / 1000)}s`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

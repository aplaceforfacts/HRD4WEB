import { NextResponse } from "next/server"
import { findDueExports, runMonthlyExport } from "@/server/export/run-monthly-export"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Daily. Sends each enabled league's workbook once a monthly period has been closed
 * for two days, and resumes any send that ran out of time the day before.
 */
export async function GET() {
  const due = await findDueExports()
  const results = []
  const started = Date.now()

  for (const period of due) {
    const budget = 250_000 - (Date.now() - started)
    if (budget < 20_000) break
    try {
      results.push({
        league: period.season.league.slug,
        year: period.season.year,
        period: period.label,
        ...(await runMonthlyExport(period.seasonId, period.id, { dryRun: false, timeBudgetMs: budget })),
      })
    } catch (error) {
      results.push({ league: period.season.league.slug, period: period.label, error: error instanceof Error ? error.message : String(error) })
    }
  }

  console.log("MONTHLY EXPORT", JSON.stringify(results))
  return NextResponse.json({ ok: true, due: due.length, results })
}

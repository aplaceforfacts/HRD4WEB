"use client"

import { useState } from "react"

type SeasonResult = { league: string; periodsProcessed: number; oddsPeriodsProcessed: number }
type SyncResult = {
  ok?: boolean
  message?: string
  gameLogs?: { players: number; games: number; missingIds: string[]; failures: string[] }
  seasons?: SeasonResult[]
}

export function AdminSyncForm({ defaultYear }: { defaultYear: number }) {
  const [year, setYear] = useState(String(defaultYear))
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runSync() {
    setPending(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/admin/sync/run?year=${encodeURIComponent(year)}`, { method: "POST" })
      const data = (await response.json()) as SyncResult
      if (!response.ok) throw new Error(data.message ?? "Sync failed.")
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown sync error")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="max-w-xl space-y-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-neutral-700">MLB season</span>
        <input
          id="sync-year"
          className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          inputMode="numeric"
          value={year}
          onChange={(event) => setYear(event.target.value)}
        />
      </label>

      <button
        className="rounded-lg border border-neutral-900 bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={pending}
        onClick={runSync}
      >
        {pending ? "Running sync…" : "Run sync"}
      </button>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      {result ? (
        <div className="space-y-1 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {result.message ? <div>{result.message}</div> : null}
          {result.gameLogs ? (
            <div>
              Game logs: {result.gameLogs.games} games for {result.gameLogs.players} players.
              {result.gameLogs.failures.length ? ` ${result.gameLogs.failures.length} players failed to load.` : ""}
              {result.gameLogs.missingIds.length ? ` No MLB ID yet: ${result.gameLogs.missingIds.join(", ")}.` : ""}
            </div>
          ) : null}
          {result.seasons?.map((season) => (
            <div key={season.league}>
              {season.league}: {season.periodsProcessed} periods scored, odds for {season.oddsPeriodsProcessed}.
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

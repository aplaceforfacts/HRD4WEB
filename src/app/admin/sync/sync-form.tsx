"use client"

import { useState } from "react"

type SyncResult = {
  ok?: boolean
  message?: string
  importedSnapshots?: number
  periodsProcessed?: number
  oddsPeriodsProcessed?: number
  maxMuncyLadId?: string
  maxMuncyAsId?: string
  season?: {
    entryStatus?: string
  }
}

export function AdminSyncForm() {
  const [secret, setSecret] = useState("")
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runSync() {
    setPending(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/admin/sync/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      })
      const data = (await response.json()) as SyncResult

      if (!response.ok) {
        throw new Error(data.message ?? "Sync failed.")
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown sync error")
    } finally {
      setPending(false)
    }
  }

  async function repairMaxMuncy() {
    setPending(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/admin/repair/max-muncy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      })
      const data = (await response.json()) as SyncResult

      if (!response.ok) {
        throw new Error(data.message ?? "Repair failed.")
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown repair error")
    } finally {
      setPending(false)
    }
  }

  async function lockEntries() {
    setPending(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/admin/season/lock-entries", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      })
      const data = (await response.json()) as SyncResult

      if (!response.ok) {
        throw new Error(data.message ?? "Lock failed.")
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown lock error")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="max-w-xl space-y-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-neutral-700">Admin secret</span>
        <input
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-neutral-900"
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
        />
      </label>

      <button
        className="rounded-lg border border-neutral-900 bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={pending || !secret}
        onClick={runSync}
      >
        {pending ? "Running sync..." : "Run scoring sync"}
      </button>

      <button
        className="ml-2 rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={pending || !secret}
        onClick={repairMaxMuncy}
      >
        Repair Max Muncy
      </button>

      <button
        className="ml-2 rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={pending || !secret}
        onClick={lockEntries}
      >
        Lock entries
      </button>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      {result ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {result.maxMuncyAsId ? (
            <>Repair complete. Run scoring sync next.</>
          ) : result.season?.entryStatus ? (
            <>Entries locked. Current status: {result.season.entryStatus}.</>
          ) : (
            <>
              Sync complete. Imported snapshots: {result.importedSnapshots ?? 0}. Periods processed:{" "}
              {result.periodsProcessed ?? 0}. Odds periods processed: {result.oddsPeriodsProcessed ?? 0}.
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

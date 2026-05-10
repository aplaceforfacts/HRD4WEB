"use client"

import { useMemo, useState } from "react"

type BatchResult = {
  ok: boolean
  mode?: string
  message?: string
  scoringPeriods?: {
    changed: number
    windows: Array<{ label: string; startDate: string; endDate: string; changed: boolean }>
  }
  players?: {
    toAdd: number
    addedOrWouldAdd: string[]
    skippedExisting: string[]
  }
  entries?: {
    totalReceived: number
    resolvable: number
    createdOrWouldCreate: number
    skippedDuplicates: number
  }
  invalidEntries?: Array<{ sourceRow: number; entryName: string; message: string }>
  unresolvedPlayers?: Array<{ sourceRow: number; entryName: string; groupCode: string; pick: string }>
  skipSourceRows?: number[]
}

async function callBatchIngest(payloadText: string, secret: string, commit: boolean) {
  const payload = JSON.parse(payloadText)

  const response = await fetch("/api/admin/batch-ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ payload, commit }),
  })

  const data = (await response.json()) as BatchResult
  if (!response.ok && !data.invalidEntries?.length && !data.unresolvedPlayers?.length) {
    throw new Error(data.message ?? "Batch ingest failed.")
  }

  return data
}

export function BatchIngestForm() {
  const [payloadText, setPayloadText] = useState("")
  const [secret, setSecret] = useState("")
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canCommit = useMemo(
    () => Boolean(result && !result.invalidEntries?.length && !result.unresolvedPlayers?.length),
    [result],
  )

  async function run(commit: boolean) {
    setPending(true)
    setError(null)

    try {
      const nextResult = await callBatchIngest(payloadText, secret, commit)
      setResult(nextResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setPending(false)
    }
  }

  async function loadFile(file: File | undefined) {
    if (!file) return
    setPayloadText(await file.text())
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-neutral-700">Payload JSON</span>
          <textarea
            className="min-h-[24rem] w-full rounded-lg border border-neutral-300 bg-white p-3 font-mono text-xs shadow-sm outline-none focus:border-neutral-900"
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            spellCheck={false}
          />
        </label>

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">Upload JSON</span>
            <input
              className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              type="file"
              accept="application/json,.json"
              onChange={(event) => loadFile(event.target.files?.[0])}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-neutral-700">Admin secret</span>
            <input
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-neutral-900"
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
          </label>

          <div className="grid gap-2">
            <button
              className="rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={pending || !payloadText || !secret}
              onClick={() => run(false)}
            >
              Validate / Dry Run
            </button>
            <button
              className="rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={pending || !payloadText || !secret || !canCommit}
              onClick={() => run(true)}
            >
              Commit Import
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      {result ? <ResultPanel result={result} /> : null}
    </div>
  )
}

function ResultPanel({ result }: { result: BatchResult }) {
  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Preview</h2>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
          {result.mode ?? "result"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Players to add" value={result.players?.toAdd ?? 0} />
        <Metric label="Entries received" value={result.entries?.totalReceived ?? 0} />
        <Metric label="Entries ready" value={result.entries?.createdOrWouldCreate ?? 0} />
        <Metric label="Duplicate entries" value={result.entries?.skippedDuplicates ?? 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ListBlock title="Invalid Entries" items={(result.invalidEntries ?? []).map((row) => `${row.sourceRow}: ${row.entryName} - ${row.message}`)} />
        <ListBlock
          title="Unresolved Players"
          items={(result.unresolvedPlayers ?? []).map(
            (row) => `${row.sourceRow}: ${row.entryName} / ${row.groupCode} / ${row.pick}`,
          )}
        />
      </div>

      <ListBlock
        title="Scoring Windows"
        items={(result.scoringPeriods?.windows ?? []).map(
          (window) => `${window.label}: ${window.startDate} to ${window.endDate}${window.changed ? " (changed)" : ""}`,
        )}
      />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {items.length ? (
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <ul className="space-y-1 text-xs text-neutral-700">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">None</p>
      )}
    </div>
  )
}

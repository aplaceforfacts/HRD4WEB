"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

type HistoricalStat = {
  seasonYear: number
  homeRuns: number
  atBats: number | null
  sluggingPct: number | null
}

type Projection = {
  source: string
  projectedHomeRuns: number | null
  projectedAtBats: number | null
  projectedSluggingPct: number | null
}

type PlayerOption = {
  id: string
  fullName: string
  mlbTeam: string | null
  primaryPosition: string | null
  historicalStats: HistoricalStat[]
  projections: Projection[]
}

type PlayerPickerProps = {
  value: string | null
  options: PlayerOption[]
  onChange: (playerId: string) => void
  placeholder?: string
}

function formatPct(value: number | null | undefined) {
  if (value == null) return "—"
  return value.toFixed(3)
}

export function PlayerPicker({ value, options, onChange, placeholder = "Search players" }: PlayerPickerProps) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options

    return options.filter((player) => {
      const haystack = [player.fullName, player.mlbTeam ?? "", player.primaryPosition ?? ""].join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [options, query])

  return (
    <div className="space-y-3">
      <input
        className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-neutral-200">
        <div className="grid divide-y divide-neutral-100">
          {filtered.map((player) => {
            const selected = value === player.id
            const stats2025 = player.historicalStats.find((s) => s.seasonYear === 2025)
            const stats2024 = player.historicalStats.find((s) => s.seasonYear === 2024)
            const firstProjection = player.projections[0]

            return (
              <button
                key={player.id}
                type="button"
                onClick={() => onChange(player.id)}
                className={cn("w-full px-4 py-4 text-left transition hover:bg-neutral-50", selected && "bg-neutral-100")}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-neutral-900">{player.fullName}</div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {[player.mlbTeam, player.primaryPosition].filter(Boolean).join(" • ") || "—"}
                    </div>
                  </div>
                  {selected ? (
                    <span className="rounded-full border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700">
                      Selected
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">2025</div>
                    <div className="mt-2 text-sm text-neutral-700">
                      HR: {stats2025?.homeRuns ?? "—"} · AB: {stats2025?.atBats ?? "—"} · SLG: {formatPct(stats2025?.sluggingPct)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">2024</div>
                    <div className="mt-2 text-sm text-neutral-700">
                      HR: {stats2024?.homeRuns ?? "—"} · AB: {stats2024?.atBats ?? "—"} · SLG: {formatPct(stats2024?.sluggingPct)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      {firstProjection?.source ?? "Projection"}
                    </div>
                    <div className="mt-2 text-sm text-neutral-700">
                      HR: {firstProjection?.projectedHomeRuns ?? "—"} · AB: {firstProjection?.projectedAtBats ?? "—"} · SLG: {formatPct(firstProjection?.projectedSluggingPct)}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

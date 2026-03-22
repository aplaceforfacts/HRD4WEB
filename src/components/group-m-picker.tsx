"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

type HistoricalStat = {
  seasonYear: number
  homeRuns: number
}

type Projection = {
  source: string
  projectedHomeRuns: number | null
}

type PlayerOption = {
  id: string
  fullName: string
  mlbTeam: string | null
  primaryPosition: string | null
  historicalStats: HistoricalStat[]
  projections: Projection[]
}

type GroupMPickerProps = {
  value: string[]
  options: PlayerOption[]
  onToggle: (playerId: string, checked: boolean) => void
}

export function GroupMPicker({ value, options, onToggle }: GroupMPickerProps) {
  const [query, setQuery] = useState("")
  const [teamFilter, setTeamFilter] = useState("all")

  const teams = useMemo(() => {
    return Array.from(new Set(options.map((player) => player.mlbTeam).filter(Boolean))).sort() as string[]
  }, [options])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return options.filter((player) => {
      const matchesQuery = !q || [player.fullName, player.mlbTeam ?? "", player.primaryPosition ?? ""].join(" ").toLowerCase().includes(q)
      const matchesTeam = teamFilter === "all" || player.mlbTeam === teamFilter
      return matchesQuery && matchesTeam
    })
  }, [options, query, teamFilter])

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
        <input
          className="rounded-xl border border-neutral-300 px-3 py-2.5"
          placeholder="Search Group M players"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="rounded-xl border border-neutral-300 px-3 py-2.5"
          value={teamFilter}
          onChange={(event) => setTeamFilter(event.target.value)}
        >
          <option value="all">All teams</option>
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="px-4 py-3">Pick</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">2025 HR</th>
              <th className="px-4 py-3">2024 HR</th>
              <th className="px-4 py-3">Proj HR</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((player) => {
              const checked = value.includes(player.id)
              const disabled = !checked && value.length >= 4
              const stats2025 = player.historicalStats.find((s) => s.seasonYear === 2025)
              const stats2024 = player.historicalStats.find((s) => s.seasonYear === 2024)
              const projection = player.projections[0]

              return (
                <tr key={player.id} className={cn("border-b border-neutral-100 last:border-0", checked && "bg-neutral-50")}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(event) => onToggle(player.id, event.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{player.fullName}</td>
                  <td className="px-4 py-3">{player.mlbTeam ?? "—"}</td>
                  <td className="px-4 py-3">{stats2025?.homeRuns ?? "—"}</td>
                  <td className="px-4 py-3">{stats2024?.homeRuns ?? "—"}</td>
                  <td className="px-4 py-3">{projection?.projectedHomeRuns ?? "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

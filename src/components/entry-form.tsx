"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PlayerPicker } from "@/components/player-picker"
import { GroupMPicker } from "@/components/group-m-picker"

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

type GroupData = {
  id: string
  code: string
  name: string
  selectionCount: number
  seasonPlayers: { player: PlayerOption }[]
}

type SeasonData = {
  id: string
  name: string
  groups: GroupData[]
}

function getCompletion(groups: GroupData[], selections: Record<string, string[]>) {
  let complete = 0

  for (const group of groups) {
    const selected = selections[group.code] ?? []
    if (group.code === "M") {
      if (selected.length === 4) complete += 1
    } else if (selected.length === 1) {
      complete += 1
    }
  }

  return complete
}

export function EntryForm({ season }: { season: SeasonData }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [selections, setSelections] = useState<Record<string, string[]>>({})

  const groups = useMemo(() => season.groups, [season.groups])
  const completedGroups = getCompletion(groups, selections)
  const progressPercent = Math.round((completedGroups / groups.length) * 100)

  function updateSingle(groupCode: string, playerId: string) {
    setSelections((prev) => ({ ...prev, [groupCode]: playerId ? [playerId] : [] }))
  }

  function updateMulti(groupCode: string, playerId: string, checked: boolean) {
    setSelections((prev) => {
      const current = prev[groupCode] ?? []
      const next = checked ? [...current, playerId].slice(0, 4) : current.filter((id) => id !== playerId)
      return { ...prev, [groupCode]: next }
    })
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)

    try {
      const payload = {
        seasonId: season.id,
        ownerName: name,
        ownerEmail: email,
        selections: Object.entries(selections).flatMap(([groupCode, ids]) =>
          ids.map((playerId) => ({ groupCode, playerId })),
        ),
      }

      const response = await fetch("/api/public/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        setMessage(data.message ?? "Submission failed.")
        return
      }

      setMessage("Entry submitted successfully.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <form className="space-y-6" onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Build your entry</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Search by name, team, and position. Compare past-year results and projections while you build.
                </p>
              </div>
              <Badge>
                {completedGroups} / {groups.length} complete
              </Badge>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="rounded-xl border border-neutral-300 px-3 py-2.5"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <input
                className="rounded-xl border border-neutral-300 px-3 py-2.5"
                placeholder="Your email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        {groups.map((group) => {
          const selected = selections[group.code] ?? []
          const isComplete = group.code === "M" ? selected.length === 4 : selected.length === 1
          const options = group.seasonPlayers.map((row) => row.player)

          return (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{group.name}</h3>
                    <p className="mt-1 text-sm text-neutral-600">
                      {group.code === "M" ? "Choose 4 players from the open pool." : "Choose 1 player from this category."}
                    </p>
                  </div>
                  <Badge className={isComplete ? "border-emerald-200 text-emerald-700" : ""}>
                    {group.code === "M" ? `${selected.length} / 4 selected` : isComplete ? "Selected" : "Not selected"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {group.code === "M" ? (
                  <GroupMPicker value={selected} options={options} onToggle={(playerId, checked) => updateMulti(group.code, playerId, checked)} />
                ) : (
                  <PlayerPicker
                    value={selected[0] ?? null}
                    options={options}
                    onChange={(playerId) => updateSingle(group.code, playerId)}
                    placeholder={`Search ${group.name}`}
                  />
                )}
              </CardContent>
            </Card>
          )
        })}

        <div className="flex items-center gap-4">
          <button
            className="rounded-xl bg-neutral-900 px-5 py-3 font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
            type="submit"
            disabled={pending}
          >
            {pending ? "Submitting..." : "Submit Entry"}
          </button>
          {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
        </div>
      </form>

      <aside className="lg:sticky lg:top-6 lg:h-fit">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Roster summary</h2>
            <p className="mt-1 text-sm text-neutral-600">Your picks update instantly as you build your entry.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {groups.map((group) => {
                const selected = selections[group.code] ?? []
                const selectedPlayers = group.seasonPlayers.map((row) => row.player).filter((player) => selected.includes(player.id))

                return (
                  <div key={group.id} className="rounded-xl border border-neutral-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-neutral-900">{group.code}</div>
                      <div className="text-xs text-neutral-400">{group.code === "M" ? `${selected.length}/4` : selected.length ? "1/1" : "0/1"}</div>
                    </div>
                    {selectedPlayers.length > 0 ? (
                      <div className="mt-2 space-y-2 text-neutral-700">
                        {selectedPlayers.map((player) => (
                          <div key={player.id} className="rounded-lg bg-neutral-50 px-2.5 py-2">
                            <div className="font-medium">{player.fullName}</div>
                            <div className="text-xs text-neutral-500">{player.mlbTeam ?? "—"}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-neutral-400">No selection yet</div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

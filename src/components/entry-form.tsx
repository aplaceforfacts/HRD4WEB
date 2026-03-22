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

function getSelectedPlayers(group: GroupData, selections: Record<string, string[]>) {
  const selectedIds = selections[group.code] ?? []
  return group.seasonPlayers
    .map((row) => row.player)
    .filter((player) => selectedIds.includes(player.id))
}

export function EntryForm({ season }: { season: SeasonData }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [selections, setSelections] = useState<Record<string, string[]>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const groups = useMemo(() => season.groups, [season.groups])
  const completedGroups = getCompletion(groups, selections)
  const progressPercent = Math.round((completedGroups / groups.length) * 100)

  function collapseGroup(groupCode: string) {
    setCollapsedGroups((prev) => ({ ...prev, [groupCode]: true }))
  }

  function expandGroup(groupCode: string) {
    setCollapsedGroups((prev) => ({ ...prev, [groupCode]: false }))
  }

  function updateSingle(groupCode: string, playerId: string) {
    setSelections((prev) => ({ ...prev, [groupCode]: playerId ? [playerId] : [] }))
    if (playerId) collapseGroup(groupCode)
  }

  function updateMulti(groupCode: string, playerId: string, checked: boolean) {
    setSelections((prev) => {
      const current = prev[groupCode] ?? []
      const next = checked
        ? [...current, playerId].slice(0, 4)
        : current.filter((id) => id !== playerId)

      setCollapsedGroups((collapsed) => ({
        ...collapsed,
        [groupCode]: next.length === 4,
      }))

      return { ...prev, [groupCode]: next }
    })
  }

  function resetAll() {
    setSelections({})
    setCollapsedGroups({})
    setMessage(null)
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
          ids.map((playerId) => ({ groupCode, playerId }))
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <form className="space-y-5" onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Build your entry</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Categories collapse after a valid pick. Use Change pick to reopen any section.
                </p>
              </div>
              <Badge>{completedGroups} / {groups.length} complete</Badge>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-neutral-900 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
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
          const isCollapsed = collapsedGroups[group.code] && isComplete
          const options = group.seasonPlayers.map((row) => row.player)
          const selectedPlayers = getSelectedPlayers(group, selections)

          return (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{group.name}</h3>
                    <p className="mt-1 text-sm text-neutral-600">
                      {group.code === "M"
                        ? "Choose 4 players from the open pool."
                        : "Choose 1 player from this category."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={isComplete ? "border-emerald-200 text-emerald-700" : ""}>
                      {group.code === "M"
                        ? `${selected.length} / 4 selected`
                        : isComplete
                          ? "Selected"
                          : "Not selected"}
                    </Badge>

                    {isComplete ? (
                      <button
                        type="button"
                        onClick={() => expandGroup(group.code)}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                      >
                        Change pick
                      </button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {isCollapsed ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="space-y-1.5 text-sm">
                      {selectedPlayers.map((player) => (
                        <div key={player.id}>
                          <span className="font-medium">{player.fullName}</span>
                          {player.mlbTeam ? (
                            <span className="text-neutral-500"> ({player.mlbTeam})</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : group.code === "M" ? (
                  <GroupMPicker
                    value={selected}
                    options={options}
                    onToggle={(playerId, checked) => updateMulti(group.code, playerId, checked)}
                  />
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

        <div className="flex flex-wrap items-center gap-4">
          <button
            className="rounded-xl bg-neutral-900 px-5 py-3 font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
            type="submit"
            disabled={pending}
          >
            {pending ? "Submitting..." : "Submit Entry"}
          </button>

          <button
            type="button"
            onClick={resetAll}
            className="rounded-xl border border-neutral-300 px-5 py-3 font-medium hover:bg-neutral-50"
          >
            Reset all picks
          </button>

          {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
        </div>
      </form>

      <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Roster summary</h2>
              <Badge>{completedGroups}/{groups.length}</Badge>
            </div>
            <p className="text-xs text-neutral-600">Visible while you scroll.</p>
          </CardHeader>

          <CardContent className="h-[calc(100%-4.5rem)] overflow-y-auto pt-0">
            <div className="space-y-2.5">
              {groups.map((group) => {
                const selectedPlayers = getSelectedPlayers(group, selections)
                const countLabel =
                  group.code === "M"
                    ? `${selectedPlayers.length}/4`
                    : selectedPlayers.length
                      ? "1/1"
                      : "0/1"

                return (
                  <div key={group.id} className="rounded-lg border border-neutral-200 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{group.code}</div>
                      <div className="text-[11px] text-neutral-500">{countLabel}</div>
                    </div>

                    {selectedPlayers.length > 0 ? (
                      <div className="mt-1.5 space-y-1 text-[12px] leading-4 text-neutral-700">
                        {selectedPlayers.map((player) => (
                          <div key={player.id}>
                            <span className="font-medium">{player.fullName}</span>
                            {player.mlbTeam ? (
                              <span className="text-neutral-500"> ({player.mlbTeam})</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1.5 text-[12px] text-neutral-400">No selection yet</div>
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
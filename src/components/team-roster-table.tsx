"use client"

import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table"
import { usePhoneLayout } from "@/components/standings/use-phone-layout"

type TeamRosterRow = {
  entryPlayerId: string
  slotNumber: number
  groupCode: string
  groupName: string
  playerId: string
  playerName: string
  team: string | null
  homeRuns: number
  rankInGroup: number | null
  isTied: boolean
  /** Position in the season's group order, for the default sort. */
  order: number
  /** True for a group that takes several picks (Group M), shown as M-1, M-2… */
  multiPick: boolean
}

const groupLabel = (row: TeamRosterRow) => (row.multiPick ? `${row.groupCode}-${row.slotNumber}` : row.groupCode)
const groupRank = (row: TeamRosterRow) => (row.rankInGroup ? `${row.isTied ? "T-" : ""}#${row.rankInGroup}` : "—")

export function TeamRosterTable({ rows }: { rows: TeamRosterRow[] }) {
  const isPhone = usePhoneLayout()

  const player: DataColumn<TeamRosterRow> = {
    key: "playerName",
    label: "Player",
    render: (_, row) =>
      isPhone ? (
        <>
          <span className="mr-2 text-slate-500">{groupLabel(row)}</span>
          {row.playerName}
        </>
      ) : (
        row.playerName
      ),
  }
  const group: DataColumn<TeamRosterRow> = { key: "order", label: "Group", numeric: false, width: 96, render: (_, row) => groupLabel(row) }
  const team: DataColumn<TeamRosterRow> = { key: "team", label: "Team", width: 96, render: (_, row) => row.team ?? "—" }
  const homeRuns: DataColumn<TeamRosterRow> = { key: "homeRuns", label: "HR", numeric: true, width: 80 }
  const rank: DataColumn<TeamRosterRow> = {
    key: "rankInGroup",
    label: "Group rank",
    numeric: true,
    width: 120,
    render: (_, row) => groupRank(row),
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Your roster contributions</h2>
      <SortableDataTable
        rows={rows}
        columns={isPhone ? [player, homeRuns, team, rank] : [group, player, team, homeRuns, rank]}
        rowKey="entryPlayerId"
        caption="Roster contributions"
        defaultSort={{ key: "order", direction: "asc" }}
        itemName={{ one: "player", other: "players" }}
      />
    </section>
  )
}

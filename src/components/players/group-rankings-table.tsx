"use client"

import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table"
import { usePhoneLayout } from "@/components/standings/use-phone-layout"

export type GroupRankingRow = {
  id: string
  rank: number
  isTied: boolean
  fullName: string
  mlbTeam: string | null
  score: number
  /** Null when the period isn't being projected (finished or not current). */
  projectedScore: number | null
  pickPercentage: number
}

const place = (row: GroupRankingRow) => `${row.isTied ? "T-" : ""}${row.rank}`

export function GroupRankingsTable({ rows, groupName }: { rows: GroupRankingRow[]; groupName: string }) {
  const isPhone = usePhoneLayout()
  const showProjection = rows.some((row) => row.projectedScore !== null)

  const rank: DataColumn<GroupRankingRow> = { key: "rank", label: "Place", numeric: true, width: 88, render: (_, row) => place(row) }
  const player: DataColumn<GroupRankingRow> = {
    key: "fullName",
    label: "Player",
    render: (_, row) => (
      <>
        {isPhone ? <span className="mr-2 tabular-nums text-slate-500">{place(row)}</span> : null}
        {row.fullName}
      </>
    ),
  }
  const team: DataColumn<GroupRankingRow> = { key: "mlbTeam", label: "Team", width: 88, render: (_, row) => row.mlbTeam ?? "—" }
  const homeRuns: DataColumn<GroupRankingRow> = { key: "score", label: "HR", numeric: true, width: 80 }
  const projected: DataColumn<GroupRankingRow> = {
    key: "projectedScore",
    label: "Projected",
    numeric: true,
    width: 112,
    render: (_, row) => (row.projectedScore === null ? "—" : `${isPhone ? "Proj " : ""}${row.projectedScore.toFixed(1)}`),
  }
  const picked: DataColumn<GroupRankingRow> = {
    key: "pickPercentage",
    label: "Picked by",
    numeric: true,
    width: 112,
    render: (_, row) => `${(row.pickPercentage * 100).toFixed(1)}%${isPhone ? " picked" : ""}`,
  }

  const optional = showProjection ? [projected] : []

  return (
    <SortableDataTable
      rows={rows}
      columns={isPhone ? [player, homeRuns, team, ...optional, picked] : [rank, player, team, homeRuns, ...optional, picked]}
      rowKey="id"
      caption={`${groupName} rankings`}
      defaultSort={{ key: "rank", direction: "asc" }}
      itemName={{ one: "player", other: "players" }}
    />
  )
}

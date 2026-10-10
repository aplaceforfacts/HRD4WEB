"use client"

import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table"
import { usePhoneLayout } from "@/components/standings/use-phone-layout"

export type OptimalRow = {
  id: string
  order: number
  groupLabel: string
  playerName: string
  homeRuns: number
  pickPercentage: number
}

export function OptimalTable({ rows, periodLabel }: { rows: OptimalRow[]; periodLabel: string }) {
  const isPhone = usePhoneLayout()

  const group: DataColumn<OptimalRow> = { key: "order", label: "Group", numeric: false, width: 96, render: (_, row) => row.groupLabel }
  const player: DataColumn<OptimalRow> = {
    key: "playerName",
    label: "Player",
    render: (_, row) => (
      <>
        {isPhone ? <span className="mr-2 text-slate-500">{row.groupLabel}</span> : null}
        {row.playerName}
      </>
    ),
  }
  const homeRuns: DataColumn<OptimalRow> = { key: "homeRuns", label: "HR", numeric: true, width: 80 }
  const picked: DataColumn<OptimalRow> = {
    key: "pickPercentage",
    label: "Picked by",
    numeric: true,
    width: 112,
    render: (_, row) => `${isPhone ? "Picked by " : ""}${(row.pickPercentage * 100).toFixed(1)}%`,
  }

  return (
    <SortableDataTable
      rows={rows}
      columns={isPhone ? [player, homeRuns, picked] : [group, player, homeRuns, picked]}
      rowKey="id"
      caption={`${periodLabel} optimal lineup`}
      defaultSort={{ key: "order", direction: "asc" }}
      itemName={{ one: "player", other: "players" }}
    />
  )
}

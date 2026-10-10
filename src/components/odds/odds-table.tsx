"use client"

import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table"
import { usePhoneLayout } from "@/components/standings/use-phone-layout"

export type OddsRow = {
  id: string
  rank: number
  isTied: boolean
  teamName: string
  currentHomeRuns: number
  expectedFinalHr: number
  winProbability: number
  top3Probability: number
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`
const place = (row: OddsRow) => `${row.isTied ? "T-" : ""}${row.rank}`

export function OddsTable({ rows, periodLabel }: { rows: OddsRow[]; periodLabel: string }) {
  const isPhone = usePhoneLayout()

  const rank: DataColumn<OddsRow> = { key: "rank", label: "Place", numeric: true, width: 88, render: (_, row) => place(row) }
  const team: DataColumn<OddsRow> = {
    key: "teamName",
    label: "Team",
    render: (_, row) => (
      <>
        {isPhone ? <span className="mr-2 tabular-nums text-slate-500">{place(row)}</span> : null}
        {row.teamName}
      </>
    ),
  }
  const win: DataColumn<OddsRow> = {
    key: "winProbability",
    label: "Win",
    numeric: true,
    width: 96,
    render: (_, row) => <span className="font-semibold">{percent(row.winProbability)}</span>,
  }
  const top3: DataColumn<OddsRow> = { key: "top3Probability", label: "Top 3", numeric: true, width: 96, render: (_, row) => `${isPhone ? "Top 3 " : ""}${percent(row.top3Probability)}` }
  const current: DataColumn<OddsRow> = { key: "currentHomeRuns", label: "HR now", numeric: true, width: 96, render: (_, row) => `${row.currentHomeRuns}${isPhone ? " HR now" : ""}` }
  const expected: DataColumn<OddsRow> = {
    key: "expectedFinalHr",
    label: "Expected HR",
    numeric: true,
    width: 120,
    render: (_, row) => `${isPhone ? "Exp " : ""}${row.expectedFinalHr.toFixed(1)}`,
  }

  return (
    <SortableDataTable
      rows={rows}
      columns={isPhone ? [team, win, current, expected, top3] : [rank, team, current, expected, win, top3]}
      rowKey="id"
      caption={`${periodLabel} win odds`}
      defaultSort={{ key: "rank", direction: "asc" }}
      itemName={{ one: "team", other: "teams" }}
    />
  )
}

"use client"

import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table"
import { usePhoneLayout } from "@/components/standings/use-phone-layout"

type GapRow = {
  groupCode: string
  slotNumber: number
  optimalPlayerName: string
  optimalHomeRuns: number
  yourPlayerName: string | null
  yourHomeRuns: number
  gap: number
  order: number
  multiPick: boolean
}

const groupLabel = (row: GapRow) => (row.multiPick ? `${row.groupCode}-${row.slotNumber}` : row.groupCode)

export function TeamGapTable({ rows }: { rows: GapRow[] }) {
  const isPhone = usePhoneLayout()
  const keyed = rows.map((row) => ({ ...row, key: `${row.groupCode}-${row.slotNumber}` }))
  type Row = (typeof keyed)[number]

  const group: DataColumn<Row> = { key: "order", label: "Group", numeric: false, width: 88, render: (_, row) => groupLabel(row) }
  const yours: DataColumn<Row> = {
    key: "yourPlayerName",
    label: "Your pick",
    render: (_, row) => (
      <>
        {isPhone ? <span className="mr-2 text-slate-500">{groupLabel(row)}</span> : null}
        {row.yourPlayerName ?? "—"}
        {isPhone ? <span className="text-slate-500"> ({row.yourHomeRuns})</span> : null}
      </>
    ),
  }
  const yourHr: DataColumn<Row> = { key: "yourHomeRuns", label: "Your HR", numeric: true, width: 96 }
  const best: DataColumn<Row> = {
    key: "optimalPlayerName",
    label: "Optimal pick",
    render: (_, row) => (isPhone ? `Best: ${row.optimalPlayerName} (${row.optimalHomeRuns})` : row.optimalPlayerName),
  }
  const bestHr: DataColumn<Row> = { key: "optimalHomeRuns", label: "Optimal HR", numeric: true, width: 112 }
  const gap: DataColumn<Row> = {
    key: "gap",
    label: "Gap",
    numeric: true,
    width: 80,
    render: (_, row) => <span className={row.gap > 0 ? "font-semibold text-rose-700" : "text-slate-500"}>{row.gap > 0 ? `−${row.gap}` : "0"}</span>,
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Gap to optimal</h2>
      <SortableDataTable
        rows={keyed}
        columns={isPhone ? [yours, gap, best] : [group, yours, yourHr, best, bestHr, gap]}
        rowKey="key"
        caption="Gap to optimal"
        defaultSort={{ key: "order", direction: "asc" }}
        itemName={{ one: "slot", other: "slots" }}
      />
    </section>
  )
}

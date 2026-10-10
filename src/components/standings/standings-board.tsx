"use client"

import Link from "next/link"
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table"
import { leagueHref, type LinkContext } from "@/lib/paths"
import { usePhoneLayout } from "./use-phone-layout"

export type StandingsBoardRow = {
  entryId: string
  rank: number
  isTied: boolean
  teamName: string
  homeRuns: number
  /** Places gained (positive) or lost since yesterday; null when not tracked. */
  movement: number | null
  bestPick: string
  bestPickHomeRuns: number
}

const placeLabel = (row: StandingsBoardRow) => `${row.isTied ? "T-" : ""}${row.rank}`

function movementLabel(value: number | null) {
  if (value === null) return ""
  if (value === 0) return "–"
  return value > 0 ? `▲ ${value}` : `▼ ${Math.abs(value)}`
}

/** Standings as an Arc sortable table. Rows animate into place when re-sorted. */
export function StandingsBoard({
  rows,
  ctx,
  periodSlug,
  periodLabel,
  showMovement,
}: {
  rows: StandingsBoardRow[]
  ctx: LinkContext
  periodSlug: string
  periodLabel: string
  showMovement: boolean
}) {
  const isPhone = usePhoneLayout()

  const place: DataColumn<StandingsBoardRow> = { key: "rank", label: "Place", numeric: true, width: 88, render: (_, row) => placeLabel(row) }
  const movement: DataColumn<StandingsBoardRow> = {
    key: "movement",
    label: "Move",
    numeric: true,
    width: 84,
    render: (_, row) => (
      <span className={row.movement && row.movement > 0 ? "text-emerald-700" : row.movement ? "text-rose-700" : "text-slate-400"}>
        {movementLabel(row.movement)}
      </span>
    ),
  }
  const team = (withPlace: boolean): DataColumn<StandingsBoardRow> => ({
    key: "teamName",
    label: "Team",
    render: (_, row) => (
      <Link href={leagueHref(ctx, `/team/${row.entryId}`, { period: periodSlug })} className="font-medium hover:underline">
        {withPlace ? <span className="mr-2 tabular-nums text-slate-500">{placeLabel(row)}</span> : null}
        {row.teamName}
      </Link>
    ),
  })
  const bestPick: DataColumn<StandingsBoardRow> = {
    key: "bestPick",
    label: "Best pick",
    render: (_, row) =>
      row.bestPickHomeRuns > 0 ? `${row.bestPick} (${row.bestPickHomeRuns})` : <span className="text-slate-400">—</span>,
  }
  const homeRuns: DataColumn<StandingsBoardRow> = { key: "homeRuns", label: "HR", numeric: true, width: 88 }

  // On phones Arc puts the first column and the first number on line one, so the
  // team (with its place) and HR lead; the rest folds onto the second line.
  const columns = isPhone
    ? [team(true), homeRuns, bestPick, ...(showMovement ? [movement] : [])]
    : [place, ...(showMovement ? [movement] : []), team(false), bestPick, homeRuns]

  return (
    <SortableDataTable
      rows={rows}
      columns={columns}
      rowKey="entryId"
      caption={`${periodLabel} standings`}
      emptyMessage="No standings yet for this period."
      defaultSort={{ key: "rank", direction: "asc" }}
      itemName={{ one: "team", other: "teams" }}
    />
  )
}

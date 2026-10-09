"use client"

import { useState } from "react"
import Link from "next/link"
import { leagueHref, type LinkContext } from "@/lib/paths"

type RowPlayer = {
  id: string
  fullName: string
  mlbTeam: string | null
  pickPercentage: number
  homeRuns: number
  groupRank: number | null
  isTied: boolean
}

type StandingRow = {
  id: string
  rank: number
  isTied?: boolean
  teamName: string
  entryId: string
  homeRuns: number
  rankMovement?: number | null
  selectedPlayers: RowPlayer[]
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatStandingRank(rank: number, isTied?: boolean) {
  return `${isTied ? "T-" : ""}${rank}`
}

function formatOrdinal(value: number) {
  const mod100 = value % 100

  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`
  }

  const mod10 = value % 10

  if (mod10 === 1) return `${value}st`
  if (mod10 === 2) return `${value}nd`
  if (mod10 === 3) return `${value}rd`
  return `${value}th`
}

function formatGroupRank(rank: number | null, isTied: boolean) {
  if (!rank) return "—"
  return `${isTied ? "T-" : ""}${formatOrdinal(rank)}`
}

export function StandingsTable({ rows, ctx, periodSlug }: { rows: StandingRow[]; ctx: LinkContext; periodSlug: string }) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const showMovement = rows.some((row) => row.rankMovement !== undefined)

  function toggleRow(rowId: string) {
    setExpandedRows((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }))
  }

  if (rows.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-neutral-500">
        No standings yet for this period.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50">
          <tr className="border-b border-neutral-200 text-left text-neutral-500">
            <th className="px-5 py-3 font-medium">Rank</th>
            {showMovement ? (
              <th className="px-5 py-3 font-medium">Move</th>
            ) : null}
            <th className="px-5 py-3 font-medium">Team</th>
            <th className="px-5 py-3 font-medium text-right">HR</th>
            <th className="px-5 py-3 font-medium text-right">Roster</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const isExpanded = !!expandedRows[row.id]

            return (
              <FragmentRow
                key={row.id}
                row={row}
                isExpanded={isExpanded}
                showMovement={showMovement}
                onToggle={() => toggleRow(row.id)}
                teamHref={leagueHref(ctx, `/team/${row.entryId}`, { period: periodSlug })}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FragmentRow({
  row,
  isExpanded,
  showMovement,
  onToggle,
  teamHref,
}: {
  row: StandingRow
  isExpanded: boolean
  showMovement: boolean
  onToggle: () => void
  teamHref: string
}) {
  const movement = formatMovement(row.rankMovement)

  return (
    <>
      <tr className="border-b border-neutral-100 align-middle">
        <td className="px-5 py-4 font-semibold">
          {formatStandingRank(row.rank, row.isTied)}
        </td>

        {showMovement ? (
          <td className="px-5 py-4">
            <span className={movement.className}>{movement.label}</span>
          </td>
        ) : null}

        <td className="px-5 py-4">
          <Link
            href={teamHref}
            className="font-medium text-neutral-900 hover:underline"
          >
            {row.teamName}
          </Link>
        </td>

        <td className="px-5 py-4 text-right font-semibold tabular-nums">
          {row.homeRuns}
        </td>

        <td className="px-5 py-4 text-right">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            {isExpanded ? "Hide roster" : "Expand roster"}
          </button>
        </td>
      </tr>

      {isExpanded ? (
        <tr className="border-b border-neutral-100 bg-neutral-50 last:border-0">
          <td colSpan={showMovement ? 5 : 4} className="px-5 py-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
              {row.selectedPlayers.map((player) => (
                <div
                  key={`${row.id}-${player.id}`}
                  className="rounded-lg border border-neutral-200 bg-white px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-neutral-900">
                        {player.fullName}
                        {player.mlbTeam ? (
                          <span className="text-neutral-500"> ({player.mlbTeam})</span>
                        ) : null}
                      </div>

                      <div className="mt-1 text-xs text-neutral-500">
                        Pick %:{" "}
                        <span className="font-medium text-neutral-700">
                          {formatPercent(player.pickPercentage)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium text-neutral-900 tabular-nums">
                        {player.homeRuns}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {formatGroupRank(player.groupRank, player.isTied)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function formatMovement(rankMovement: number | null | undefined) {
  if (rankMovement === undefined || rankMovement === null || rankMovement === 0) {
    return {
      label: "—",
      className: "font-semibold tabular-nums text-neutral-400",
    }
  }

  if (rankMovement > 0) {
    return {
      label: `↑ ${rankMovement}`,
      className: "font-semibold tabular-nums text-emerald-700",
    }
  }

  return {
    label: `↓ ${Math.abs(rankMovement)}`,
    className: "font-semibold tabular-nums text-red-700",
  }
}

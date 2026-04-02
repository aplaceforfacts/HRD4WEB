"use client"

import { useState } from "react"
import Link from "next/link"

type RowPlayer = {
  id: string
  fullName: string
  mlbTeam: string | null
  pickPercentage: number
}

type StandingRow = {
  id: string
  rank: number
  ownerName: string
  entryId: string
  homeRuns: number
  selectedPlayers: RowPlayer[]
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

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
            <th className="px-5 py-3 font-medium">Owner</th>
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
                onToggle={() => toggleRow(row.id)}
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
  onToggle,
}: {
  row: StandingRow
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr className="border-b border-neutral-100 align-middle">
        <td className="px-5 py-4 font-semibold">{row.rank}</td>

        <td className="px-5 py-4">
          <Link
            href={`/team/${row.entryId}`}
            className="font-medium text-neutral-900 hover:underline"
          >
            {row.ownerName}
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
          <td colSpan={4} className="px-5 py-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {row.selectedPlayers.map((player) => (
                <div
                  key={`${row.id}-${player.id}`}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2"
                >
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
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { periodLabelToSlug } from "@/lib/utils"
import { StandingsTable } from "@/components/standings-table"
import { getOddsBoard } from "@/server/odds/get-entry-win-odds"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{
    period: string
  }>
}

function normalizePeriodSlug(value: string) {
  return decodeURIComponent(value)
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function withEntryRanks<T extends { homeRuns: number }>(rows: T[]) {
  const ranked: Array<T & { rank: number; isTied: boolean }> = []

  let currentRank = 1

  for (let index = 0; index < rows.length; ) {
    const tiedScore = rows[index].homeRuns
    const tiedRows: T[] = []

    while (index < rows.length && rows[index].homeRuns === tiedScore) {
      tiedRows.push(rows[index])
      index += 1
    }

    const isTied = tiedRows.length > 1

    for (const row of tiedRows) {
      ranked.push({
        ...row,
        rank: currentRank,
        isTied,
      })
    }

    currentRank += tiedRows.length
  }

  return ranked
}

export default async function StandingsPeriodPage({ params }: PageProps) {
  const { period } = await params

  const season = await prisma.season.findUnique({
    where: { year: 2026 },
    include: {
      scoringPeriods: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!season) {
    notFound()
  }

  const normalizedPeriod = normalizePeriodSlug(period)

  const scoringPeriod = season.scoringPeriods.find(
    (item) =>
      item.label.toLowerCase() === decodeURIComponent(period).toLowerCase() ||
      normalizePeriodSlug(item.label) === normalizedPeriod
  )

  if (!scoringPeriod) {
    notFound()
  }

  const [scores, totalEntries, picksByPlayer, oddsBoard] = await Promise.all([
    prisma.entryPeriodScore.findMany({
      where: {
        seasonId: season.id,
        scoringPeriodId: scoringPeriod.id,
      },
      include: {
        entry: {
          include: {
            owner: true,
            players: {
              include: {
                player: {
                  include: {
                    periodStats: {
                      where: {
                        scoringPeriodId: scoringPeriod.id,
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ homeRuns: "desc" }, { updatedAt: "asc" }],
    }),
    prisma.entry.count({
      where: {
        seasonId: season.id,
      },
    }),
    prisma.entryPlayer.groupBy({
      by: ["playerId"],
      where: {
        entry: {
          seasonId: season.id,
        },
      },
      _count: {
        playerId: true,
      },
    }),
    getOddsBoard(scoringPeriod.label, 2026).catch(() => null),
  ])

  const pickCountMap = new Map<string, number>(
    picksByPlayer.map((row) => [row.playerId, row._count.playerId])
  )

  const baseRows = scores.map((row) => {
    const selectedPlayers = row.entry.players
      .map((entryPlayer) => {
        const periodStat = entryPlayer.player.periodStats[0] ?? null
        const pickCount = pickCountMap.get(entryPlayer.playerId) ?? 0
        const pickPercentage = totalEntries > 0 ? pickCount / totalEntries : 0

        return {
          id: entryPlayer.player.id,
          fullName: entryPlayer.player.fullName,
          mlbTeam: entryPlayer.player.mlbTeam,
          pickPercentage,
          homeRuns: periodStat?.homeRuns ?? 0,
          groupRank: periodStat?.rankInGroup ?? null,
          isTied: periodStat?.isTied ?? false,
        }
      })
      .sort((a, b) => {
        if (b.homeRuns !== a.homeRuns) return b.homeRuns - a.homeRuns
        return a.fullName.localeCompare(b.fullName)
      })

    return {
      id: row.id,
      ownerName: row.entry.owner.name,
      entryId: row.entry.id,
      homeRuns: row.homeRuns,
      selectedPlayers,
    }
  })

  const rows = withEntryRanks(baseRows)
  const oddsRows = oddsBoard?.rows?.slice(0, 5) ?? []
  const periodSlug = periodLabelToSlug(scoringPeriod.label)

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-3">
        <Link
          href="/standings"
          className="inline-flex text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Back to all periods
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {scoringPeriod.label} Standings
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{season.name}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {season.scoringPeriods.map((item) => {
              const isActive = item.id === scoringPeriod.id
              const href = `/standings/${normalizePeriodSlug(item.label)}`

              return (
                <Link
                  key={item.id}
                  href={href}
                  className={
                    isActive
                      ? "rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white transition"
                      : "rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-50"
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/odds?period=${periodSlug}`}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            View win odds
          </Link>
          <Link
            href={`/optimal?period=${periodSlug}`}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            View optimal lineup
          </Link>
        </div>
      </div>

      {oddsRows.length > 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-lg font-semibold">Win odds snapshot</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Top estimated chances for {scoringPeriod.label}.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Current HR</th>
                  <th className="px-5 py-3">Expected final HR</th>
                  <th className="px-5 py-3">Win %</th>
                </tr>
              </thead>
              <tbody>
                {oddsRows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-5 py-4 font-medium">{row.rank}</td>
                    <td className="px-5 py-4">{row.ownerName}</td>
                    <td className="px-5 py-4">{row.currentHomeRuns}</td>
                    <td className="px-5 py-4">{row.expectedFinalHr.toFixed(1)}</td>
                    <td className="px-5 py-4 font-semibold">{formatPercent(row.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <StandingsTable rows={rows} />
      </div>
    </div>
  )
}
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{
    period: string
  }>
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
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

  const scoringPeriod = season.scoringPeriods.find(
    (item) =>
      item.slug === period ||
      (item.code && item.code.toLowerCase() === period.toLowerCase())
  )

  if (!scoringPeriod) {
    notFound()
  }

  const [scores, totalEntries, picksByPlayer] = await Promise.all([
    prisma.entryPeriodScore.findMany({
      where: {
        seasonId: season.id,
        scoringPeriodId: scoringPeriod.id,
      },
      include: {
        entry: {
          include: {
            owner: true,
            entryPlayers: {
              include: {
                player: true,
              },
            },
          },
        },
      },
      orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
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
  ])

  const pickCountMap = new Map<string, number>(
    picksByPlayer.map((row) => [row.playerId, row._count.playerId])
  )

  const rows = scores.map((row, index) => {
    const selectedPlayers = row.entry.entryPlayers.map((entryPlayer) => {
      const pickCount = pickCountMap.get(entryPlayer.playerId) ?? 0
      const pickPercentage = totalEntries > 0 ? pickCount / totalEntries : 0

      return {
        id: entryPlayer.player.id,
        fullName: entryPlayer.player.fullName,
        mlbTeam: entryPlayer.player.mlbTeam,
        pickPercentage,
      }
    })

    return {
      id: row.id,
      rank: index + 1,
      ownerName: row.entry.owner.name,
      entryId: row.entry.id,
      score: row.score,
      selectedPlayers,
    }
  })

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
              {scoringPeriod.name} Standings
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{season.name}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {season.scoringPeriods.map((item) => {
              const isActive = item.id === scoringPeriod.id

              return (
                <Link
                  key={item.id}
                  href={`/standings/${item.slug}`}
                  className={
                    isActive
                      ? "rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white transition"
                      : "rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-50"
                  }
                >
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-5 py-3 font-medium">Rank</th>
                <th className="px-5 py-3 font-medium">Owner</th>
                <th className="px-5 py-3 font-medium text-right">HR</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-10 text-center text-neutral-500"
                  >
                    No standings yet for this period.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-100 align-top last:border-0"
                  >
                    <td className="px-5 py-4 font-semibold">{row.rank}</td>

                    <td className="px-5 py-4">
                      <div className="space-y-2">
                        <Link
                          href={`/team/${row.entryId}`}
                          className="font-medium text-neutral-900 hover:underline"
                        >
                          {row.ownerName}
                        </Link>

                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {row.selectedPlayers.map((player) => (
                            <div
                              key={`${row.id}-${player.id}`}
                              className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2"
                            >
                              <div className="text-sm font-medium text-neutral-900">
                                {player.fullName}
                                {player.mlbTeam ? (
                                  <span className="text-neutral-500">
                                    {" "}
                                    ({player.mlbTeam})
                                  </span>
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
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right font-semibold tabular-nums">
                      {row.score}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
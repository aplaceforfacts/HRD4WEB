import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { StandingsTable } from "@/components/standings-table"

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
            players: {
              include: {
                player: true,
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
  ])

  const pickCountMap = new Map<string, number>(
    picksByPlayer.map((row) => [row.playerId, row._count.playerId])
  )

  const rows = scores.map((row, index) => {
    const selectedPlayers = row.entry.players.map((entryPlayer) => {
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
      homeRuns: row.homeRuns,
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
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <StandingsTable rows={rows} />
      </div>
    </div>
  )
}
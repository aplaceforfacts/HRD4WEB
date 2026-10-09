export const dynamic = "force-dynamic"

import Link from "next/link"
import { EntrySearch } from "@/components/entry-search"
import { Card, CardContent } from "@/components/ui/card"
import {
  getPeriodLifecycleStatus,
  getPeriodDisplayEndDate,
  orderPeriodsForStandings,
  periodSlug,
  type MonthStatus,
} from "@/lib/periods"
import { leagueHref, linkContext } from "@/lib/paths"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { requireSeasonContext } from "@/server/season/resolve-season"

type ScoreWithOwner = {
  homeRuns: number
  entry: {
    teamName: string
  }
}

function getPodiumGroups(scores: ScoreWithOwner[]) {
  const podium: Record<1 | 2 | 3, string[]> = {
    1: [],
    2: [],
    3: [],
  }

  let currentRank = 1

  for (let index = 0; index < scores.length; ) {
    const tiedScore = scores[index].homeRuns
    const tiedRows: ScoreWithOwner[] = []

    while (index < scores.length && scores[index].homeRuns === tiedScore) {
      tiedRows.push(scores[index])
      index += 1
    }

    if (currentRank === 1 || currentRank === 2 || currentRank === 3) {
      podium[currentRank] = tiedRows.map((row) => row.entry.teamName)
    }

    currentRank += tiedRows.length
  }

  return podium
}

function formatNames(names: string[]) {
  return names.length > 0 ? names.join(", ") : "-"
}

function statusLabel(status: MonthStatus) {
  return status.replace("_", " ")
}

export default async function StandingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>
  searchParams: Promise<{ season?: string }>
}) {
  const context = await requireSeasonContext((await params).league, (await searchParams).season)
  const ctx = linkContext(context)
  const season = await prisma.season.findUnique({
    where: { id: context.season.id },
    include: {
      scoringPeriods: {
        orderBy: { sortOrder: "asc" },
        include: {
          entryScores: {
            include: {
              entry: { select: { teamName: true } },
            },
            orderBy: [{ homeRuns: "desc" }, { entry: { teamName: "asc" } }],
          },
          optimalLineup: true,
        },
      },
    },
  })

  if (!season) return <div>Season not found.</div>

  const orderedPeriods = orderPeriodsForStandings(season.scoringPeriods)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Standings</h1>
          <p className="text-neutral-600">Choose a scoring period for {season.name}.</p>
        </div>
        <EntrySearch seasonId={season.id} ctx={ctx} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orderedPeriods.map((period) => {
          const slug = periodSlug(period.label)
          const status = getPeriodLifecycleStatus(period)
          const isArchived = status === "archived"
          const podium = getPodiumGroups(period.entryScores)
          const displayEndDate = getPeriodDisplayEndDate(period)

          return (
            <Card
              key={period.id}
              className={cn(
                "h-full",
                isArchived && "border-neutral-200 bg-neutral-50 shadow-none",
              )}
            >
              <CardContent className={cn("space-y-3", isArchived && "py-4")}>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={cn(
                        "font-semibold",
                        isArchived ? "text-base text-neutral-800" : "text-lg",
                      )}
                    >
                      {period.label}
                    </div>
                    <div
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                        status === "active" && "bg-emerald-100 text-emerald-800",
                        status === "upcoming" && "bg-sky-100 text-sky-800",
                        status === "recently_completed" &&
                          "bg-amber-100 text-amber-800",
                        status === "archived" && "bg-neutral-200 text-neutral-700",
                      )}
                    >
                      {statusLabel(status)}
                    </div>
                  </div>
                  <div className="text-sm text-neutral-500">
                    {period.startDate.toDateString()} – {displayEndDate.toDateString()}
                  </div>
                </div>

                {isArchived ? (
                  <div className="space-y-1.5 text-sm text-neutral-700">
                    <div>
                      <span className="font-medium text-neutral-900">1st:</span>{" "}
                      {formatNames(podium[1])}
                    </div>
                    <div>
                      <span className="font-medium text-neutral-900">2nd:</span>{" "}
                      {formatNames(podium[2])}
                    </div>
                    <div>
                      <span className="font-medium text-neutral-900">3rd:</span>{" "}
                      {formatNames(podium[3])}
                    </div>
                    <div>
                      <span className="font-medium text-neutral-900">Optimal:</span>{" "}
                      {period.optimalLineup?.totalHomeRuns ?? "-"} HR
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={leagueHref(ctx, `/standings/${slug}`)}
                    className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Standings
                  </Link>
                  {status === "active" ? (
                    <Link
                      href={leagueHref(ctx, "/odds", { period: slug })}
                      className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Win odds
                    </Link>
                  ) : null}
                  <Link
                    href={leagueHref(ctx, "/optimal", { period: slug })}
                    className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Optimal lineup
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

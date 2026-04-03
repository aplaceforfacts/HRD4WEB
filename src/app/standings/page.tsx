export const dynamic = "force-dynamic"

import Link from "next/link"
import { EntrySearch } from "@/components/entry-search"
import { Card, CardContent } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import { periodLabelToSlug } from "@/lib/utils"

export default async function StandingsPage() {
  const season = await prisma.season.findUnique({
    where: { year: 2026 },
    include: { scoringPeriods: { orderBy: { sortOrder: "asc" } } },
  })

  if (!season) return <div>Season not found.</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Standings</h1>
          <p className="text-neutral-600">Choose a scoring period for {season.name}.</p>
        </div>
        <EntrySearch />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {season.scoringPeriods.map((period) => {
          const slug = periodLabelToSlug(period.label)

          return (
            <Card key={period.id} className="h-full">
              <CardContent className="space-y-3">
                <div>
                  <div className="text-lg font-semibold">{period.label}</div>
                  <div className="text-sm text-neutral-500">
                    {period.startDate.toDateString()} – {period.endDate.toDateString()}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/standings/${slug}`}
                    className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Standings
                  </Link>
                  <Link
                    href={`/odds?period=${slug}`}
                    className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Win odds
                  </Link>
                  <Link
                    href={`/optimal?period=${slug}`}
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
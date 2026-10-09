export const dynamic = "force-dynamic"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { leagueHref, linkContext } from "@/lib/paths"
import { prisma } from "@/lib/prisma"
import { requireSeasonContext } from "@/server/season/resolve-season"

export default async function PlayersPage({
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
      groups: {
        orderBy: { sortOrder: "asc" },
        include: {
          seasonPlayers: true,
        },
      },
    },
  })

  if (!season) return <div>Season not found.</div>

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Players by Category</h1>
        <p className="text-neutral-600">Browse each roster bucket and view period rankings.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {season.groups.map((group) => (
          <Link key={group.id} href={leagueHref(ctx, `/players/${group.code}`)}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:bg-neutral-50">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold">{group.name}</div>
                  <Badge>{group.code}</Badge>
                </div>
                <div className="text-sm text-neutral-600">{group.seasonPlayers.length} players in this category.</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

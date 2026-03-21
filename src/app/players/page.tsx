import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"

export default async function PlayersPage() {
  const season = await prisma.season.findUnique({
    where: { year: 2026 },
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
          <Link key={group.id} href={`/players/${group.code}`}>
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

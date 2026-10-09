import { Suspense } from "react"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { prisma } from "@/lib/prisma"
import { pickCurrentSeason, RESERVED_LEAGUE_SLUGS } from "@/server/season/resolve-season"

export const dynamic = "force-dynamic"

async function loadLeague(slug: string) {
  if (RESERVED_LEAGUE_SLUGS.has(slug)) return null
  return prisma.league.findUnique({
    where: { slug: slug.toLowerCase() },
    include: { seasons: { select: { year: true, entryStatus: true }, orderBy: { year: "desc" } } },
  })
}

export async function generateMetadata({ params }: { params: Promise<{ league: string }> }) {
  const league = await loadLeague((await params).league)
  return { title: league?.name ?? "Home Run Derby" }
}

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ league: string }>
}) {
  const league = await loadLeague((await params).league)
  if (!league || league.seasons.length === 0) notFound()

  return (
    <>
      <Suspense>
        <SiteHeader
          leagueSlug={league.slug}
          leagueName={league.name}
          seasons={league.seasons.map((season) => ({ year: season.year, entriesOpen: season.entryStatus === "OPEN" }))}
          currentYear={pickCurrentSeason(league.seasons).year}
        />
      </Suspense>
      <main className="app-shell relative">{children}</main>
    </>
  )
}

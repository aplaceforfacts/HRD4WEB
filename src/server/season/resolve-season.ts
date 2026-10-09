import { cache } from "react"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"

/** Top-level route names a league slug may not take. */
export const RESERVED_LEAGUE_SLUGS = new Set(["admin", "api", "_next", "favicon.ico", "robots.txt"])

export const LEAGUE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export type SeasonContext = Awaited<ReturnType<typeof loadSeasonContext>>

/**
 * The season a league's pages show by default: the newest one past setup, so next
 * year's season can be built in the background without hiding this year's results.
 * Seasons are newest first.
 */
export function pickCurrentSeason<T extends { year: number; entryStatus: string }>(seasons: T[]) {
  return seasons.find((season) => season.entryStatus !== "SETUP") ?? seasons[0]
}

const loadSeasonContext = cache(async (leagueSlug: string, seasonParam: string | undefined) => {
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug.toLowerCase() },
    include: {
      seasons: {
        select: { id: true, year: true, entryStatus: true },
        orderBy: { year: "desc" },
      },
    },
  })

  if (!league || league.seasons.length === 0) return null

  const requestedYear = seasonParam && /^\d{4}$/.test(seasonParam) ? Number(seasonParam) : null
  const currentYear = pickCurrentSeason(league.seasons).year
  const year = requestedYear ?? currentYear
  const seasonRef = league.seasons.find((row) => row.year === year)

  if (!seasonRef) return null

  const season = await prisma.season.findUniqueOrThrow({
    where: { id: seasonRef.id },
    include: { scoringPeriods: { orderBy: { sortOrder: "asc" } } },
  })

  return {
    league: { id: league.id, slug: league.slug, name: league.name, timeZone: league.timeZone },
    season,
    years: league.seasons.map((row) => row.year),
    /** True for the league's default season; links then omit ?season=. */
    isCurrent: year === currentYear,
  }
})

/**
 * Resolves the league from the URL segment and the season from ?season=YYYY
 * (defaulting to the league's latest season). Renders the 404 page when either
 * doesn't exist, so pages can rely on the result.
 */
export async function requireSeasonContext(leagueSlug: string, seasonParam?: string | string[]) {
  const param = Array.isArray(seasonParam) ? seasonParam[0] : seasonParam
  const context = await loadSeasonContext(leagueSlug, param)
  if (!context) notFound()
  return context
}

/** Every season currently being played (any league), for the nightly sync. */
export async function getSeasonsForYear(year: number) {
  return prisma.season.findMany({
    where: { year },
    include: { scoringPeriods: true, league: true },
  })
}

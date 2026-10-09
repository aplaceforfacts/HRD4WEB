import { SeasonStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { applyScoringPeriodWindows, type SeasonDates, zonedTimeToUtc } from "@/server/scoring/scoring-period-windows"
import { getRegularSeasonDates } from "@/server/stats/mlb-stats-api"
import { LEAGUE_SLUG_PATTERN, RESERVED_LEAGUE_SLUGS } from "./resolve-season"

const DEFAULT_GROUPS: Array<{ code: string; selectionCount: number }> = [
  ..."ABCDEFGHIJKL".split("").map((code) => ({ code, selectionCount: 1 })),
  { code: "M", selectionCount: 4 },
]

export type SetupSeasonInput = {
  leagueSlug: string
  /** Required only when the league doesn't exist yet. */
  leagueName?: string
  year: number
  /** Override MLB's published dates (e.g. before MLB publishes them). */
  seasonDates?: SeasonDates
}

/**
 * Creates (or tops up) a league's season for an MLB year: the season row with
 * MLB's dates, the same groups as the league's previous season (A–L + M by
 * default), the scoring periods, and last year's prize sheet with the year updated.
 * Safe to re-run; it never touches entries or the player pool.
 */
export async function setupSeason(input: SetupSeasonInput) {
  const slug = input.leagueSlug.toLowerCase()
  if (!LEAGUE_SLUG_PATTERN.test(slug) || RESERVED_LEAGUE_SLUGS.has(slug)) {
    throw new Error(`"${input.leagueSlug}" can't be a league slug: use lowercase letters, digits and dashes.`)
  }

  const existingLeague = await prisma.league.findUnique({ where: { slug } })
  if (!existingLeague && !input.leagueName) {
    throw new Error(`League "${slug}" doesn't exist yet; pass a league name to create it.`)
  }

  const league =
    existingLeague ??
    (await prisma.league.create({ data: { slug, name: input.leagueName! } }))

  const dates = input.seasonDates ?? (await getRegularSeasonDates(input.year))
  const [startYear, startMonth, startDay] = dates.startDate.split("-").map(Number)

  const previous = await prisma.season.findFirst({
    where: { leagueId: league.id, year: { lt: input.year } },
    orderBy: { year: "desc" },
    include: { groups: { orderBy: { sortOrder: "asc" } } },
  })

  const season = await prisma.season.upsert({
    where: { leagueId_year: { leagueId: league.id, year: input.year } },
    update: {
      regularSeasonStart: new Date(`${dates.startDate}T00:00:00.000Z`),
      regularSeasonEnd: new Date(`${dates.endDate}T00:00:00.000Z`),
    },
    create: {
      leagueId: league.id,
      year: input.year,
      name: `${league.name} ${input.year}`,
      // Entries close the night before opening day, league time.
      entryDeadlineAt: zonedTimeToUtc(startYear, startMonth - 1, startDay - 1, 23, 59, 59, league.timeZone),
      regularSeasonStart: new Date(`${dates.startDate}T00:00:00.000Z`),
      regularSeasonEnd: new Date(`${dates.endDate}T00:00:00.000Z`),
      entryStatus: SeasonStatus.SETUP,
      prizesText: previous?.prizesText?.replaceAll(String(previous.year), String(input.year)) ?? null,
    },
  })

  const groups = previous?.groups.length
    ? previous.groups.map((group) => ({ code: group.code, name: group.name, selectionCount: group.selectionCount }))
    : DEFAULT_GROUPS.map((group) => ({ ...group, name: `Group ${group.code}` }))

  for (const [index, group] of groups.entries()) {
    await prisma.group.upsert({
      where: { seasonId_code: { seasonId: season.id, code: group.code } },
      update: {},
      create: {
        seasonId: season.id,
        code: group.code,
        name: group.name,
        selectionCount: group.selectionCount,
        sortOrder: index + 1,
      },
    })
  }

  const periods = await applyScoringPeriodWindows(season.id, dates, true)

  return { league, season, groups: groups.length, periods: periods.windows.map((window) => window.label) }
}

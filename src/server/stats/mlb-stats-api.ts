const MLB_BASE = "https://statsapi.mlb.com/api/v1"

export type MlbPersonSearchResult = {
  id: number
  fullName: string
  currentTeam?: { id: number; name: string; abbreviation?: string }
  primaryPosition?: { abbreviation: string }
}

export type PlayerSeasonSnapshot = {
  homeRuns: number
  atBats: number
  sluggingPct: number | null
  gamesPlayed: number
  teamCode: string | null
  teamId: number | null
  statusCode: string | null
  statusDescription: string | null
  isActive: boolean
}

export async function searchMlbPlayerByName(name: string) {
  const url = `${MLB_BASE}/people/search?names=${encodeURIComponent(name)}`
  const res = await fetch(url, { cache: "no-store" })

  if (!res.ok) {
    throw new Error(`MLB search failed for ${name}`)
  }

  const data = await res.json()
  return (data.people ?? []) as MlbPersonSearchResult[]
}

export async function getPlayerSeasonSnapshot(playerId: number, season = 2026): Promise<PlayerSeasonSnapshot> {
  const [statsRes, personRes] = await Promise.all([
    fetch(
      `${MLB_BASE}/people/${playerId}/stats?stats=season&group=hitting&season=${season}&gameType=R`,
      { cache: "no-store" },
    ),
    fetch(`${MLB_BASE}/people/${playerId}`, { cache: "no-store" }),
  ])

  if (!statsRes.ok) {
    throw new Error(`MLB stats failed for player ${playerId}`)
  }

  if (!personRes.ok) {
    throw new Error(`MLB person failed for player ${playerId}`)
  }

  const statsData = await statsRes.json()
  const personData = await personRes.json()

  const split = statsData?.stats?.[0]?.splits?.[0]
  const stat = split?.stat ?? {}
  const person = personData?.people?.[0] ?? {}

  const statusCode =
    person?.rosterStatus ??
    person?.activeStatus ??
    person?.status?.code ??
    person?.status?.description ??
    null

  const statusDescription =
    person?.status?.description ??
    person?.rosterStatus ??
    person?.activeStatus ??
    null

  const isActive =
    Boolean(person?.active) ||
    String(statusCode ?? "").toUpperCase() === "A" ||
    String(statusDescription ?? "").toLowerCase() === "active"

  return {
    homeRuns: Number(stat.homeRuns ?? 0),
    atBats: Number(stat.atBats ?? 0),
    sluggingPct: stat.slg
      ? Number(stat.slg)
      : stat.slugging
        ? Number(stat.slugging)
        : null,
    gamesPlayed: Number(stat.gamesPlayed ?? 0),
    teamCode: split?.team?.abbreviation ?? person?.currentTeam?.abbreviation ?? null,
    teamId: split?.team?.id ?? person?.currentTeam?.id ?? null,
    statusCode: statusCode ? String(statusCode) : null,
    statusDescription: statusDescription ? String(statusDescription) : null,
    isActive,
  }
}

export async function getTeamGamesScheduledBetween(
  teamId: number,
  startDate: Date,
  endDate: Date,
): Promise<number> {
  if (endDate < startDate) {
    return 0
  }

  const url =
    `${MLB_BASE}/schedule?teamId=${teamId}&sportId=1&gameType=R` +
    `&startDate=${toApiDate(startDate)}&endDate=${toApiDate(endDate)}`

  const res = await fetch(url, { cache: "no-store" })

  if (!res.ok) {
    throw new Error(`MLB schedule failed for team ${teamId}`)
  }

  const data = await res.json()
  const dates = Array.isArray(data?.dates) ? data.dates : []

  return dates.reduce((total: number, dateRow: { games?: unknown[] }) => {
    return total + (Array.isArray(dateRow.games) ? dateRow.games.length : 0)
  }, 0)
}

function toApiDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

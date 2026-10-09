const MLB_BASE = "https://statsapi.mlb.com/api/v1"

const TEAM_DIRECTORY_TTL_MS = 60 * 60 * 1000
const ROSTER_TTL_MS = 10 * 60 * 1000
const SCHEDULE_TTL_MS = 10 * 60 * 1000

export type MlbPersonSearchResult = {
  id: number
  fullName: string
  currentTeam?: { id: number; name: string; abbreviation?: string }
  primaryPosition?: { abbreviation: string }
}

/**
 * How available a player is for the rest of the schedule. This is sourced from the
 * 40-man roster feed: `/people/{id}` stopped returning `status`/`rosterStatus`, so
 * classifying off that endpoint silently marked every player ACTIVE.
 */
export type RosterAvailability =
  | "ACTIVE"
  | "IL_SHORT"
  | "IL_60"
  | "MINORS"
  | "SUSPENDED"

export type PlayerSeasonSnapshot = {
  homeRuns: number
  atBats: number
  sluggingPct: number | null
  gamesPlayed: number
  teamCode: string | null
  teamName: string | null
  teamId: number | null
  statusCode: string | null
  statusDescription: string | null
  availability: RosterAvailability
  isOnMlbRoster: boolean
  isActive: boolean
}

export type TeamGameCounts = {
  /** Regular-season games the team has completed as of the latest daily snapshot. */
  played: number
  /** Regular-season games left inside the requested scoring window. */
  remaining: number
}

type CacheEntry = { value: Promise<unknown>; expiresAt: number }

const requestCache = new Map<string, CacheEntry>()

/**
 * Small TTL memo so a page that projects hundreds of players issues one roster /
 * schedule fetch per team instead of one per player. Deliberately not React
 * `cache()` — this module also runs from the cron route and standalone scripts.
 */
function memo<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = requestCache.get(key)

  if (hit && hit.expiresAt > now) {
    return hit.value as Promise<T>
  }

  const value = factory().catch((error) => {
    requestCache.delete(key)
    throw error
  })

  requestCache.set(key, { value, expiresAt: now + ttlMs })

  return value
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" })

  if (!res.ok) {
    throw new Error(`MLB request failed (${res.status}): ${url}`)
  }

  return res.json()
}

export async function searchMlbPlayerByName(name: string) {
  const data = await fetchJson(`${MLB_BASE}/people/search?names=${encodeURIComponent(name)}`)
  return (data.people ?? []) as MlbPersonSearchResult[]
}

type TeamDirectoryEntry = { id: number; abbreviation: string | null; name: string | null }

function getTeamDirectory(season: number) {
  return memo(`teams:${season}`, TEAM_DIRECTORY_TTL_MS, async () => {
    const data = await fetchJson(`${MLB_BASE}/teams?sportId=1&season=${season}`)
    const directory = new Map<number, TeamDirectoryEntry>()

    for (const team of data.teams ?? []) {
      if (typeof team?.id !== "number") continue
      directory.set(team.id, {
        id: team.id,
        abbreviation: team.abbreviation ?? null,
        name: team.name ?? null,
      })
    }

    return directory
  })
}

/** MLB team id -> abbreviation ("NYY"), for labeling players by their latest club. */
export async function getTeamAbbreviations(season: number) {
  const directory = await getTeamDirectory(season)
  return new Map([...directory.values()].map((team) => [team.id, team.abbreviation]))
}

type RosterEntry = {
  statusCode: string | null
  statusDescription: string | null
  teamId: number
}

/**
 * playerId -> current 40-man roster placement. A traded player only appears on the
 * roster of the club he is on right now, so this doubles as the authoritative
 * "which team is he on today" lookup.
 */
function getLeagueRosterIndex(season: number) {
  return memo(`roster:${season}`, ROSTER_TTL_MS, async () => {
    const directory = await getTeamDirectory(season)
    const index = new Map<number, RosterEntry>()

    await Promise.all(
      [...directory.keys()].map(async (teamId) => {
        try {
          const data = await fetchJson(
            `${MLB_BASE}/teams/${teamId}/roster?rosterType=40Man&season=${season}`,
          )

          for (const row of data.roster ?? []) {
            const personId = row?.person?.id
            if (typeof personId !== "number") continue

            index.set(personId, {
              statusCode: row?.status?.code ?? null,
              statusDescription: row?.status?.description ?? null,
              teamId,
            })
          }
        } catch {
          // A single unreachable club should not blank out the whole league index.
        }
      }),
    )

    return index
  })
}

const IL_60_CODES = new Set(["D60"])
const IL_SHORT_CODES = new Set(["D7", "D10", "D15"])
const MINORS_CODES = new Set(["RM", "MIN", "OPT", "ASG", "DES", "OUT"])
const SUSPENDED_CODES = new Set(["SU", "RES"])

export function classifyRosterAvailability(
  statusCode: string | null,
  statusDescription: string | null,
): RosterAvailability {
  const code = (statusCode ?? "").trim().toUpperCase()

  if (IL_60_CODES.has(code)) return "IL_60"
  if (IL_SHORT_CODES.has(code)) return "IL_SHORT"
  if (MINORS_CODES.has(code)) return "MINORS"
  if (SUSPENDED_CODES.has(code)) return "SUSPENDED"

  const described = (statusDescription ?? "").toLowerCase()

  if (described.includes("60-day")) return "IL_60"
  if (described.includes("injured")) return "IL_SHORT"
  if (described.includes("minors") || described.includes("assignment")) return "MINORS"
  if (described.includes("suspend") || described.includes("restricted")) return "SUSPENDED"

  return "ACTIVE"
}

export async function getPlayerSeasonSnapshot(
  playerId: number,
  season = 2026,
): Promise<PlayerSeasonSnapshot> {
  const [statsData, rosterIndex, directory] = await Promise.all([
    fetchJson(
      `${MLB_BASE}/people/${playerId}/stats?stats=season&group=hitting&season=${season}&gameType=R`,
    ),
    getLeagueRosterIndex(season),
    getTeamDirectory(season),
  ])

  const splits = (statsData?.stats?.[0]?.splits ?? []) as Array<Record<string, unknown>>

  // A player who changed clubs mid-season gets a combined row (no `team`, carries
  // `numTeams`) followed by one row per club in chronological order. `splits[0]` is
  // the season total we want for HR/AB, but its missing `team` used to null out the
  // team id and silently zero the player's remaining-games forecast.
  const totalSplit = splits.find((split) => split.team == null) ?? splits[0] ?? null
  const teamSplits = splits.filter((split) => split.team != null)
  const currentTeamSplit = teamSplits[teamSplits.length - 1] ?? null

  const stat = ((totalSplit?.stat ?? {}) as Record<string, unknown>) ?? {}
  const roster = rosterIndex.get(playerId) ?? null

  const splitTeam = (currentTeamSplit?.team ?? null) as { id?: number; name?: string } | null
  const teamId = roster?.teamId ?? splitTeam?.id ?? null
  const directoryTeam = teamId != null ? directory.get(teamId) ?? null : null

  const availability = roster
    ? classifyRosterAvailability(roster.statusCode, roster.statusDescription)
    : "ACTIVE"

  return {
    homeRuns: Number(stat.homeRuns ?? 0),
    atBats: Number(stat.atBats ?? 0),
    sluggingPct: stat.slg ? Number(stat.slg) : stat.slugging ? Number(stat.slugging) : null,
    gamesPlayed: Number(stat.gamesPlayed ?? 0),
    // `team` objects on the stats feed carry only id/name, never `abbreviation`,
    // which is why teamCode used to be null on every snapshot row.
    teamCode: directoryTeam?.abbreviation ?? null,
    teamName: directoryTeam?.name ?? splitTeam?.name ?? null,
    teamId,
    statusCode: roster?.statusCode ?? null,
    statusDescription: roster?.statusDescription ?? null,
    availability,
    isOnMlbRoster: Boolean(roster),
    isActive: availability === "ACTIVE",
  }
}

export type PlayerGameLogRow = {
  gamePk: number
  /** MLB official game date, YYYY-MM-DD. */
  gameDate: string
  teamId: number | null
  homeRuns: number
  atBats: number
  totalBases: number
}

/** Every regular-season game the player has appeared in this season, one row per game. */
export async function getPlayerGameLog(playerId: number, season: number): Promise<PlayerGameLogRow[]> {
  const data = await fetchJson(
    `${MLB_BASE}/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}&gameType=R`,
  )

  const splits = (data?.stats?.[0]?.splits ?? []) as Array<Record<string, any>>
  const rows: PlayerGameLogRow[] = []

  for (const split of splits) {
    const gamePk = split?.game?.gamePk
    const gameDate = split?.date
    if (typeof gamePk !== "number" || typeof gameDate !== "string") continue

    rows.push({
      gamePk,
      gameDate,
      teamId: typeof split?.team?.id === "number" ? split.team.id : null,
      homeRuns: Number(split?.stat?.homeRuns ?? 0),
      atBats: Number(split?.stat?.atBats ?? 0),
      totalBases: Number(split?.stat?.totalBases ?? 0),
    })
  }

  return rows
}

/** Opening day and final day of the MLB regular season, as YYYY-MM-DD. */
export async function getRegularSeasonDates(season: number) {
  const data = await fetchJson(`${MLB_BASE}/seasons/${season}?sportId=1`)
  const row = data?.seasons?.[0]

  if (!row?.regularSeasonStartDate || !row?.regularSeasonEndDate) {
    throw new Error(`MLB has not published ${season} regular-season dates yet.`)
  }

  return {
    startDate: String(row.regularSeasonStartDate),
    endDate: String(row.regularSeasonEndDate),
  }
}

type ScheduledGame = { startsAt: number; isFinal: boolean }

function getTeamRegularSeasonGames(teamId: number, season: number) {
  return memo(`schedule:${teamId}:${season}`, SCHEDULE_TTL_MS, async () => {
    const data = await fetchJson(
      `${MLB_BASE}/schedule?teamId=${teamId}&sportId=1&gameType=R&season=${season}`,
    )

    const games: ScheduledGame[] = []

    for (const date of data?.dates ?? []) {
      for (const game of date?.games ?? []) {
        const state = game?.status?.codedGameState ?? null

        // 'D' (Postponed) rows stay in the feed alongside the makeup game, and 'C'
        // (Cancelled) games are never played. Counting either inflates the schedule.
        if (state === "D" || state === "C") continue

        const startsAt = Date.parse(game?.gameDate ?? "")
        if (Number.isNaN(startsAt)) continue

        games.push({ startsAt, isFinal: game?.status?.abstractGameState === "Final" })
      }
    }

    return games
  })
}

/**
 * Counts a team's completed and remaining regular-season games.
 *
 * `snapshotCutoff` is the instant the player's stored stat line is current through
 * (the daily 6:00 AM ET scoring boundary), so "played" lines up with the games that
 * are already reflected in his home run total and "remaining" starts from there.
 * Both bounds are compared as instants, which keeps a game that starts after a
 * period closes out of that period.
 */
export async function getTeamGameCounts(
  teamId: number,
  season: number,
  snapshotCutoff: Date,
  windowStart: Date,
  windowEndExclusive: Date,
): Promise<TeamGameCounts> {
  const games = await getTeamRegularSeasonGames(teamId, season)

  const cutoff = snapshotCutoff.getTime()
  const from = Math.max(cutoff, windowStart.getTime())
  const until = windowEndExclusive.getTime()

  let played = 0
  let remaining = 0

  for (const game of games) {
    if (game.isFinal && game.startsAt < cutoff) {
      played += 1
    }

    if (game.startsAt >= from && game.startsAt < until) {
      remaining += 1
    }
  }

  return { played, remaining }
}

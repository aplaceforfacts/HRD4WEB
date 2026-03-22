const MLB_BASE = "https://statsapi.mlb.com/api/v1"

export type MlbPersonSearchResult = {
  id: number
  fullName: string
  currentTeam?: { id: number; name: string }
  primaryPosition?: { abbreviation: string }
}

export async function searchMlbPlayerByName(name: string) {
  const url = `${MLB_BASE}/people/search?names=${encodeURIComponent(name)}`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`MLB search failed for ${name}`)
  const data = await res.json()
  return (data.people ?? []) as MlbPersonSearchResult[]
}

export async function getPlayerSeasonStats(playerId: number, season = 2026) {
  const url =
    `${MLB_BASE}/people/${playerId}/stats` +
    `?stats=season&group=hitting&season=${season}&gameType=R`

  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`MLB stats failed for player ${playerId}`)
  const data = await res.json()

  const split = data?.stats?.[0]?.splits?.[0]
  const stat = split?.stat ?? {}

  return {
    homeRuns: Number(stat.homeRuns ?? 0),
    atBats: Number(stat.atBats ?? 0),
    sluggingPct: stat.slugging ? Number(stat.slugging) : null,
    teamCode: split?.team?.abbreviation ?? null,
  }
}
import { ScoringPeriodType } from "@prisma/client"
import {
  getPlayerSeasonSnapshot,
  getTeamGameCounts,
  type RosterAvailability,
} from "@/server/stats/mlb-stats-api"
import { zonedTimeToUtc } from "@/server/scoring/scoring-period-windows"

const DEFAULT_AB_PER_GAME = 4
const FULL_SEASON_TEAM_GAMES = 162
const SHORT_IL_GAMES_MISSED = 10
const SCORING_DAY_BOUNDARY_HOUR = 6
const SCORING_TIME_ZONE = "America/New_York"

/** Statuses that rule a player out entirely, regardless of rate or role. */
const UNAVAILABLE: RosterAvailability[] = ["IL_60", "MINORS", "SUSPENDED"]

const EASTERN_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCORING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function getEasternParts(date: Date) {
  const [year, month, day] = EASTERN_DATE.format(date).split("-").map(Number)
  return { year, month, day }
}

/**
 * How much weight the preseason projection still carries. Applied to BOTH the home
 * run rate and the playing-time estimate, so a player's actual role takes over on
 * the same curve his actual power does.
 */
export function getPreseasonProjectionWeight(asOfDate: Date) {
  const { month } = getEasternParts(asOfDate)

  if (month <= 4) return 1
  if (month === 5) return 0.75
  if (month === 6) return 0.5
  if (month === 7) return 0.25

  return 0
}

/**
 * The instant a player's stored stat line is current through: the most recent 6:00 AM
 * ET scoring boundary, which is the same clock the monthly periods roll on.
 */
function getScoringDayCutoff(asOfDate: Date) {
  const { year, month, day } = getEasternParts(asOfDate)
  const boundary = (dayOfMonth: number) =>
    zonedTimeToUtc(year, month - 1, dayOfMonth, SCORING_DAY_BOUNDARY_HOUR, 0, 0, SCORING_TIME_ZONE)

  const today = boundary(day)

  return today <= asOfDate ? today : boundary(day - 1)
}

function safeDivide(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (!numerator || !denominator || denominator <= 0) return null
  return numerator / denominator
}

function blend(projected: number | null, actual: number | null, weight: number) {
  if (projected === null && actual === null) return null
  if (projected === null) return actual
  if (actual === null) return projected
  return projected * weight + actual * (1 - weight)
}

function maxDate(a: Date, b: Date) {
  return a > b ? a : b
}

export type RemainingHomeRunsInput = {
  providerPlayerId: string | null
  projectionHomeRuns: number | null
  projectionAtBats: number | null
  snapshotHomeRuns: number
  snapshotAtBats: number
  snapshotGamesPlayed: number
  historicalAtBats: number | null
  historicalGamesPlayed: number | null
  seasonYear: number
  scoringPeriodType: ScoringPeriodType
  scoringPeriodStart: Date
  scoringPeriodEnd: Date
  asOfDate: Date
}

/** Bump when the forecast math changes, so stored forecasts can be compared by model. */
export const FORECAST_MODEL_VERSION = "2026-08-20"

export type RemainingHomeRunsForecast = {
  expectedRemainingHomeRuns: number
  availability: RosterAvailability | "NO_MLB_ID" | "NO_TEAM"
}

/**
 * Expected home runs a player adds between now and the end of the scoring window.
 *
 * Shared by the player rankings and the win-odds simulation so the two can never
 * drift apart.
 */
export async function estimateRemainingHomeRuns({
  providerPlayerId,
  projectionHomeRuns,
  projectionAtBats,
  snapshotHomeRuns,
  snapshotAtBats,
  snapshotGamesPlayed,
  historicalAtBats,
  historicalGamesPlayed,
  seasonYear,
  scoringPeriodType,
  scoringPeriodStart,
  scoringPeriodEnd,
  asOfDate,
}: RemainingHomeRunsInput): Promise<RemainingHomeRunsForecast> {
  if (!providerPlayerId) return { expectedRemainingHomeRuns: 0, availability: "NO_MLB_ID" }

  const live = await getPlayerSeasonSnapshot(Number(providerPlayerId), seasonYear)

  // Availability supersedes everything else: a player on the 60-day IL, in the
  // minors, or suspended adds nothing no matter how well he was hitting.
  if (UNAVAILABLE.includes(live.availability)) {
    return { expectedRemainingHomeRuns: 0, availability: live.availability }
  }

  // No MLB club means no remaining schedule to project against.
  if (!live.teamId) return { expectedRemainingHomeRuns: 0, availability: "NO_TEAM" }

  const forecast = (expectedRemainingHomeRuns: number) => ({
    expectedRemainingHomeRuns,
    availability: live.availability,
  })

  const snapshotCutoff = getScoringDayCutoff(asOfDate)
  const windowStart =
    scoringPeriodType === ScoringPeriodType.SEASON
      ? snapshotCutoff
      : maxDate(snapshotCutoff, scoringPeriodStart)

  const teamGames = await getTeamGameCounts(
    live.teamId,
    seasonYear,
    snapshotCutoff,
    windowStart,
    scoringPeriodEnd,
  )

  if (teamGames.remaining <= 0) return forecast(0)

  const weight = getPreseasonProjectionWeight(asOfDate)

  const abPerGame =
    safeDivide(snapshotAtBats, snapshotGamesPlayed) ??
    safeDivide(historicalAtBats, historicalGamesPlayed) ??
    DEFAULT_AB_PER_GAME

  const projectedTotalGames =
    projectionAtBats && projectionAtBats > 0
      ? Math.min(FULL_SEASON_TEAM_GAMES, projectionAtBats / abPerGame)
      : null

  // Role = the share of his club's games the player appears in. Blending the two
  // estimates (rather than capping remaining games at the preseason total) is what
  // lets an everyday player who has outlasted his projection keep accruing games.
  const projectedRole =
    projectedTotalGames !== null ? projectedTotalGames / FULL_SEASON_TEAM_GAMES : null
  const actualRole =
    teamGames.played > 0 ? Math.min(1, snapshotGamesPlayed / teamGames.played) : null

  const role = blend(projectedRole, actualRole, weight) ?? 1

  let remainingGames = teamGames.remaining * role

  if (live.availability === "IL_SHORT") {
    remainingGames = Math.max(0, remainingGames - SHORT_IL_GAMES_MISSED)
  }

  const projectedHrPerGame =
    projectionHomeRuns != null && projectedTotalGames
      ? projectionHomeRuns / projectedTotalGames
      : null
  const actualHrPerGame =
    snapshotGamesPlayed > 0 ? snapshotHomeRuns / snapshotGamesPlayed : null

  const hrPerGame = blend(projectedHrPerGame, actualHrPerGame, weight) ?? 0

  return forecast(Math.max(0, hrPerGame * remainingGames))
}

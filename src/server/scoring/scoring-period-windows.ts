import { ScoringPeriodType } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type PeriodWindow = {
  label: string
  startDate: Date
  endDate: Date
  sortOrder: number
  periodType: ScoringPeriodType
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

export function zonedTimeToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
  timeZone = "America/New_York",
) {
  let utc = new Date(Date.UTC(year, monthIndex, day, hour, minute, second))

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zoned = getZonedParts(utc, timeZone)
    const wantedAsUtc = Date.UTC(year, monthIndex, day, hour, minute, second)
    const actualAsUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    )
    const deltaMs = wantedAsUtc - actualAsUtc
    if (deltaMs === 0) break
    utc = new Date(utc.getTime() + deltaMs)
  }

  return utc
}

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Daily scoring boundary: periods roll over at 6:00 AM league time. */
const BOUNDARY_HOUR = 6

export type SeasonDates = {
  /** Opening day, YYYY-MM-DD. */
  startDate: string
  /** Final regular-season day, YYYY-MM-DD. */
  endDate: string
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return { year, monthIndex: month - 1, day }
}

/**
 * Monthly periods plus a whole-season period. A short opening month folds into the
 * next one (late-March opening day gives "Mar/Apr"), and a short closing month folds
 * into the one before it (a season ending in early October gives "Sep/Oct").
 * A month with fewer than 10 days of the season is "short".
 */
export function getScoringPeriodWindows(
  year: number,
  seasonDates: SeasonDates,
  timeZone = "America/New_York",
): PeriodWindow[] {
  const start = parseIsoDate(seasonDates.startDate)
  const end = parseIsoDate(seasonDates.endDate)
  if (start.year !== year || end.year !== year) {
    throw new Error(`Season dates ${seasonDates.startDate}..${seasonDates.endDate} are not in ${year}.`)
  }

  const boundary = (monthIndex: number) => zonedTimeToUtc(year, monthIndex, 1, BOUNDARY_HOUR, 0, 0, timeZone)
  const seasonStart = zonedTimeToUtc(year, start.monthIndex, start.day, 0, 0, 0, timeZone)
  const seasonEnd = boundary(end.monthIndex + 1)

  const daysInMonth = (monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const openingShort = daysInMonth(start.monthIndex) - start.day + 1 < 10
  const closingShort = end.day < 10

  // Each group is a run of calendar months scored together.
  const groups: number[][] = []
  for (let monthIndex = start.monthIndex; monthIndex <= end.monthIndex; monthIndex += 1) {
    groups.push([monthIndex])
  }
  if (openingShort && groups.length > 1) groups.splice(0, 2, [...groups[0], ...groups[1]])
  if (closingShort && groups.length > 1) groups.splice(-2, 2, [...groups[groups.length - 2], ...groups[groups.length - 1]])

  const windows: PeriodWindow[] = groups.map((months, index) => {
    const first = months[0]
    const last = months[months.length - 1]
    return {
      label: months.length === 1 ? MONTH_LABELS[first] : `${MONTH_SHORT[first]}/${MONTH_SHORT[last]}`,
      startDate: index === 0 ? seasonStart : boundary(first),
      endDate: index === groups.length - 1 ? seasonEnd : boundary(last + 1),
      sortOrder: index + 1,
      periodType: ScoringPeriodType.MONTHLY,
    }
  })

  windows.push({
    label: "Season",
    startDate: seasonStart,
    endDate: seasonEnd,
    sortOrder: windows.length + 1,
    periodType: ScoringPeriodType.SEASON,
  })

  return windows
}

/**
 * The game dates a period scores, as UTC-midnight Date values for comparing against
 * PlayerGameLog.gameDate: [from, to). A period ending at 6:00 AM on May 1 scores
 * games dated through April 30.
 */
export function getPeriodGameDateRange(
  period: { startDate: Date; endDate: Date },
  timeZone = "America/New_York",
) {
  const toDateOnly = (value: Date) => {
    const parts = getZonedParts(value, timeZone)
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  }

  return { from: toDateOnly(period.startDate), to: toDateOnly(period.endDate) }
}

export async function applyScoringPeriodWindows(seasonId: string, seasonDates: SeasonDates, commit: boolean) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { scoringPeriods: true },
  })

  if (!season) throw new Error(`Season ${seasonId} not found.`)

  const windows = getScoringPeriodWindows(season.year, seasonDates)
  const changes = windows.map((window) => {
    const existing = season.scoringPeriods.find((period) => period.label === window.label)

    return {
      label: window.label,
      startDate: window.startDate.toISOString(),
      endDate: window.endDate.toISOString(),
      changed:
        !existing ||
        existing.startDate.getTime() !== window.startDate.getTime() ||
        existing.endDate.getTime() !== window.endDate.getTime(),
    }
  })

  if (commit) {
    for (const window of windows) {
      await prisma.scoringPeriod.upsert({
        where: {
          seasonId_label: {
            seasonId: season.id,
            label: window.label,
          },
        },
        update: {
          startDate: window.startDate,
          endDate: window.endDate,
          sortOrder: window.sortOrder,
          periodType: window.periodType,
        },
        create: {
          seasonId: season.id,
          label: window.label,
          startDate: window.startDate,
          endDate: window.endDate,
          sortOrder: window.sortOrder,
          periodType: window.periodType,
        },
      })
    }
  }

  return {
    changed: changes.filter((change) => change.changed).length,
    windows: changes,
  }
}

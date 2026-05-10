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

export function getScoringPeriodWindows(year: number, timeZone = "America/New_York"): PeriodWindow[] {
  const boundary = (monthIndex: number) => zonedTimeToUtc(year, monthIndex, 1, 6, 0, 0, timeZone)

  return [
    {
      label: "Mar/Apr",
      startDate: zonedTimeToUtc(year, 2, 25, 0, 0, 0, timeZone),
      endDate: boundary(4),
      sortOrder: 1,
      periodType: ScoringPeriodType.MONTHLY,
    },
    {
      label: "May",
      startDate: boundary(4),
      endDate: boundary(5),
      sortOrder: 2,
      periodType: ScoringPeriodType.MONTHLY,
    },
    {
      label: "June",
      startDate: boundary(5),
      endDate: boundary(6),
      sortOrder: 3,
      periodType: ScoringPeriodType.MONTHLY,
    },
    {
      label: "July",
      startDate: boundary(6),
      endDate: boundary(7),
      sortOrder: 4,
      periodType: ScoringPeriodType.MONTHLY,
    },
    {
      label: "August",
      startDate: boundary(7),
      endDate: boundary(8),
      sortOrder: 5,
      periodType: ScoringPeriodType.MONTHLY,
    },
    {
      label: "September",
      startDate: boundary(8),
      endDate: boundary(9),
      sortOrder: 6,
      periodType: ScoringPeriodType.MONTHLY,
    },
    {
      label: "Season",
      startDate: zonedTimeToUtc(year, 2, 25, 0, 0, 0, timeZone),
      endDate: boundary(9),
      sortOrder: 7,
      periodType: ScoringPeriodType.SEASON,
    },
  ]
}

export async function applyScoringPeriodWindows(seasonYear: number, commit: boolean) {
  const season = await prisma.season.findUnique({
    where: { year: seasonYear },
    include: { scoringPeriods: true },
  })

  if (!season) throw new Error(`Season ${seasonYear} not found.`)

  const windows = getScoringPeriodWindows(seasonYear)
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

export function isWithinHalfOpenPeriod(date: Date, startDate: Date, endDate: Date) {
  return date >= startDate && date < endDate
}

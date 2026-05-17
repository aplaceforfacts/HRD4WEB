export const PERIODS = [
  { label: "Season", slug: "season" },
  { label: "Mar/Apr", slug: "mar-apr" },
  { label: "May", slug: "may" },
  { label: "June", slug: "june" },
  { label: "July", slug: "july" },
  { label: "August", slug: "august" },
  { label: "September", slug: "september" },
]

export type MonthStatus =
  | "upcoming"
  | "active"
  | "recently_completed"
  | "archived"

export type PeriodLifecycleInput = {
  startDate: Date
  endDate: Date
  sortOrder: number
  periodType?: "MONTHLY" | "SEASON" | string
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function dayAfter(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1)
}

function dayBefore(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() - 1)
}

export function getPeriodDisplayEndDate(
  period: Pick<PeriodLifecycleInput, "endDate">,
) {
  return period.endDate.getDate() === 1 ? dayBefore(period.endDate) : period.endDate
}

export function getPeriodLifecycleStatus(
  period: Pick<PeriodLifecycleInput, "startDate" | "endDate">,
  asOf = new Date(),
): MonthStatus {
  const today = startOfDay(asOf)
  const startsAt = startOfDay(period.startDate)
  const displayEndDate = getPeriodDisplayEndDate(period)
  const endsAfter = dayAfter(displayEndDate)

  if (today < startsAt) {
    return "upcoming"
  }

  if (today < endsAfter) {
    return "active"
  }

  const archiveStartsAt = new Date(
    displayEndDate.getFullYear(),
    displayEndDate.getMonth() + 1,
    10,
  )

  if (today < archiveStartsAt) {
    return "recently_completed"
  }

  return "archived"
}

export function isPeriodActive(
  period: Pick<PeriodLifecycleInput, "startDate" | "endDate">,
  asOf = new Date(),
) {
  return getPeriodLifecycleStatus(period, asOf) === "active"
}

export function isPeriodCompleted(
  period: Pick<PeriodLifecycleInput, "startDate" | "endDate">,
  asOf = new Date(),
) {
  const status = getPeriodLifecycleStatus(period, asOf)
  return status === "recently_completed" || status === "archived"
}

const lifecycleOrder: Record<MonthStatus, number> = {
  active: 0,
  upcoming: 1,
  recently_completed: 2,
  archived: 3,
}

export function orderPeriodsForStandings<T extends PeriodLifecycleInput>(
  periods: T[],
  asOf = new Date(),
) {
  return [...periods].sort((a, b) => {
    const aStatus = getPeriodLifecycleStatus(a, asOf)
    const bStatus = getPeriodLifecycleStatus(b, asOf)
    const statusDelta = lifecycleOrder[aStatus] - lifecycleOrder[bStatus]

    if (statusDelta !== 0) return statusDelta

    return a.sortOrder - b.sortOrder
  })
}

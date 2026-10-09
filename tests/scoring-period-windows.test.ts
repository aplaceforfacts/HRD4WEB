import { describe, expect, it } from "vitest"
import { getPeriodGameDateRange, getScoringPeriodWindows } from "@/server/scoring/scoring-period-windows"

const iso = (date: Date) => date.toISOString()

describe("getScoringPeriodWindows", () => {
  it("reproduces the 2026 periods that are in production", () => {
    const windows = getScoringPeriodWindows(2026, { startDate: "2026-03-25", endDate: "2026-09-27" })
    expect(windows.map((window) => [window.label, iso(window.startDate), iso(window.endDate)])).toEqual([
      ["Mar/Apr", "2026-03-25T04:00:00.000Z", "2026-05-01T10:00:00.000Z"],
      ["May", "2026-05-01T10:00:00.000Z", "2026-06-01T10:00:00.000Z"],
      ["June", "2026-06-01T10:00:00.000Z", "2026-07-01T10:00:00.000Z"],
      ["July", "2026-07-01T10:00:00.000Z", "2026-08-01T10:00:00.000Z"],
      ["August", "2026-08-01T10:00:00.000Z", "2026-09-01T10:00:00.000Z"],
      ["September", "2026-09-01T10:00:00.000Z", "2026-10-01T10:00:00.000Z"],
      ["Season", "2026-03-25T04:00:00.000Z", "2026-10-01T10:00:00.000Z"],
    ])
  })

  it("folds a few October days into September", () => {
    const labels = getScoringPeriodWindows(2028, { startDate: "2028-03-30", endDate: "2028-10-01" }).map((w) => w.label)
    expect(labels).toEqual(["Mar/Apr", "May", "June", "July", "August", "Sep/Oct", "Season"])
  })

  it("keeps a long March on its own", () => {
    const labels = getScoringPeriodWindows(2029, { startDate: "2029-03-15", endDate: "2029-09-30" }).map((w) => w.label)
    expect(labels.slice(0, 2)).toEqual(["March", "April"])
  })

  it("rejects dates from another year", () => {
    expect(() => getScoringPeriodWindows(2027, { startDate: "2026-03-25", endDate: "2026-09-27" })).toThrow()
  })
})

describe("getPeriodGameDateRange", () => {
  it("scores Mar/Apr games dated March 25 through April 30", () => {
    const [marApr] = getScoringPeriodWindows(2026, { startDate: "2026-03-25", endDate: "2026-09-27" })
    const range = getPeriodGameDateRange(marApr)
    expect(iso(range.from)).toBe("2026-03-25T00:00:00.000Z")
    expect(iso(range.to)).toBe("2026-05-01T00:00:00.000Z")
  })
})

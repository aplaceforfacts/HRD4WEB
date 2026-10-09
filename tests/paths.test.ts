import { describe, expect, it } from "vitest"
import { leagueHref } from "@/lib/paths"
import { findPeriodBySlug, periodSlug } from "@/lib/periods"

describe("leagueHref", () => {
  it("omits ?season= for the current season", () => {
    expect(leagueHref({ leagueSlug: "hrd" }, "/standings", { period: "may" })).toBe("/hrd/standings?period=may")
    expect(leagueHref({ leagueSlug: "hrd" }, "/")).toBe("/hrd")
  })

  it("keeps a past season on every link", () => {
    expect(leagueHref({ leagueSlug: "hrd", seasonYear: 2026 }, "/odds")).toBe("/hrd/odds?season=2026")
  })
})

describe("period slugs", () => {
  const periods = [
    { label: "Mar/Apr", periodType: "MONTHLY" },
    { label: "Sep/Oct", periodType: "MONTHLY" },
    { label: "Season", periodType: "SEASON" },
  ]

  it("round-trips labels", () => {
    expect(periodSlug("Mar/Apr")).toBe("mar-apr")
    expect(findPeriodBySlug(periods, "sep-oct")?.label).toBe("Sep/Oct")
  })

  it("falls back to the whole season", () => {
    expect(findPeriodBySlug(periods, undefined)?.label).toBe("Season")
    expect(findPeriodBySlug(periods, "nonsense")?.label).toBe("Season")
  })
})

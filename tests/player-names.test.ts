import { describe, expect, it } from "vitest"
import { normalizeTeamCode, playerNameKey, splitHostLabel } from "@/server/players/player-names"

describe("splitHostLabel", () => {
  it("splits the team code off host labels", () => {
    expect(splitHostLabel("Aaron Judge NYY")).toEqual({ name: "Aaron Judge", team: "NYY" })
    expect(splitHostLabel("Nick Kurtz A's")).toEqual({ name: "Nick Kurtz", team: "A's" })
    expect(splitHostLabel("Kyle Schwarber PHIL")).toEqual({ name: "Kyle Schwarber", team: "PHIL" })
  })

  it("keeps the two Max Muncys apart", () => {
    expect(splitHostLabel("Max Muncy A's").name).toBe("Max Muncy (A's)")
    expect(splitHostLabel("Max Muncy LAD").name).toBe("Max Muncy")
  })
})

describe("playerNameKey", () => {
  it("ignores accents, punctuation and suffixes", () => {
    expect(playerNameKey("Ronald Acuña Jr.")).toBe(playerNameKey("Ronald Acuna"))
    expect(playerNameKey("Jung Hoo-Lee")).toBe(playerNameKey("Jung Hoo Lee"))
  })

  it("maps known host misspellings", () => {
    expect(playerNameKey("Vinnie Pasquantiono")).toBe(playerNameKey("Vinnie Pasquantino"))
    expect(playerNameKey("Xander Bogarts")).toBe(playerNameKey("Xander Bogaerts"))
  })
})

describe("normalizeTeamCode", () => {
  it("maps host team spellings to MLB's", () => {
    expect(normalizeTeamCode("PHIL")).toBe("PHI")
    expect(normalizeTeamCode("ARZ")).toBe(normalizeTeamCode("AZ"))
    expect(normalizeTeamCode("A's")).toBe("ATH")
    expect(normalizeTeamCode("CHW")).toBe("CWS")
    expect(normalizeTeamCode(null)).toBeNull()
  })
})

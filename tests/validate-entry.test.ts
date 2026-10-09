import { describe, expect, it } from "vitest"
import { validateEntry, type GroupRule } from "@/server/entries/validate-entry"

const groups: GroupRule[] = [
  { code: "A", name: "Group A", selectionCount: 1, playerIds: new Set(["a1", "a2"]) },
  { code: "M", name: "Group M", selectionCount: 2, playerIds: new Set(["m1", "m2", "m3"]) },
]

describe("validateEntry", () => {
  it("accepts the right number of picks from each pool", () => {
    const result = validateEntry(
      [
        { groupCode: "A", playerId: "a1" },
        { groupCode: "M", playerId: "m1" },
        { groupCode: "M", playerId: "m3" },
      ],
      groups,
    )
    expect(result).toEqual({ isValid: true, errors: [] })
  })

  it("rejects short groups, players from another pool and duplicates", () => {
    const result = validateEntry(
      [
        { groupCode: "A", playerId: "m1" },
        { groupCode: "M", playerId: "m1" },
      ],
      groups,
    )
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain("Group M requires exactly 2 players.")
    expect(result.errors).toContain("A Group A pick isn't in that group's player pool.")
    expect(result.errors).toContain("Duplicate players are not allowed in the same entry.")
  })
})

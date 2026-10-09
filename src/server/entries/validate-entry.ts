import type { EntrySelection } from "@/types"

export type GroupRule = {
  code: string
  name: string
  selectionCount: number
  playerIds: Set<string>
}

/** Checks a roster against the season's groups: the right number of picks per group, all from that group's pool. */
export function validateEntry(selections: EntrySelection[], groups: GroupRule[]) {
  const errors: string[] = []
  const counts = new Map<string, number>()

  for (const selection of selections) {
    counts.set(selection.groupCode, (counts.get(selection.groupCode) ?? 0) + 1)
  }

  const groupByCode = new Map(groups.map((group) => [group.code, group]))

  for (const group of groups) {
    const count = counts.get(group.code) ?? 0
    if (count !== group.selectionCount) {
      errors.push(
        `${group.name} requires exactly ${group.selectionCount} player${group.selectionCount === 1 ? "" : "s"}.`,
      )
    }
  }

  for (const selection of selections) {
    const group = groupByCode.get(selection.groupCode)
    if (!group) {
      errors.push(`Unknown group ${selection.groupCode}.`)
    } else if (!group.playerIds.has(selection.playerId)) {
      errors.push(`A ${group.name} pick isn't in that group's player pool.`)
    }
  }

  const playerIds = selections.map((selection) => selection.playerId)
  if (new Set(playerIds).size !== playerIds.length) {
    errors.push("Duplicate players are not allowed in the same entry.")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

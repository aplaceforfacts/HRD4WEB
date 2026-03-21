import type { EntrySelection } from "@/types"

export function validateEntry(selections: EntrySelection[]) {
  const errors: string[] = []
  const counts = new Map<string, number>()

  for (const selection of selections) {
    counts.set(selection.groupCode, (counts.get(selection.groupCode) ?? 0) + 1)
  }

  for (const code of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]) {
    if ((counts.get(code) ?? 0) !== 1) {
      errors.push(`Group ${code} requires exactly 1 player.`)
    }
  }

  if ((counts.get("M") ?? 0) !== 4) {
    errors.push("Group M requires exactly 4 players.")
  }

  if (selections.length !== 16) {
    errors.push("Entry must contain exactly 16 total players.")
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

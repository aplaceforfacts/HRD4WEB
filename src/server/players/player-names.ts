/**
 * Name matching for player lists that come from people (the host's workbook,
 * pasted entries): accents, punctuation, "Jr." and known misspellings are ignored.
 */

/** Spellings seen in host workbooks -> the MLB spelling (both already normalized). */
export const PLAYER_NAME_ALIASES = new Map<string, string>([
  ["vinnie pasquantiono", "vinnie pasquantino"],
  ["brett batty", "brett baty"],
  ["nicholas castellanos", "nick castellanos"],
  ["yanier diaz", "yainer diaz"],
  ["sung mun song", "ha seong kim"],
  ["zach mckinstery", "zach mckinstry"],
  ["jarred kelenk", "jarred kelenic"],
  ["adley rutshman", "adley rutschman"],
  ["casey schmidt", "casey schmitt"],
  ["jasson domiguez", "jasson dominguez"],
  ["mike yasterzemski", "mike yastrzemski"],
  ["xander bogarts", "xander bogaerts"],
  ["zack dezenzo", "zach dezenzo"],
])

/** Host workbooks label a second same-named player by team; the app stores him with a suffix. */
export const SAME_NAME_PLAYER_DISPLAY_NAMES = new Map<string, string>([["Max Muncy A's", "Max Muncy (A's)"]])

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-‐‑‒–—]/g, " ")
    .replace(/[.’']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/** Comparable key for a player name: "Ronald Acuña Jr." and "Ronald Acuna" both -> "ronald acuna". */
export function playerNameKey(value: string) {
  const base = normalizeText(value)
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return PLAYER_NAME_ALIASES.get(base) ?? base
}

/** Team codes as they appear at the end of host labels ("Aaron Judge NYY", "Nick Kurtz A's"). */
const TEAM_TOKEN = /^(?:[A-Z]{2,4}|A's|AS)$/

/** "Aaron Judge NYY" -> { name: "Aaron Judge", team: "NYY" }. */
export function splitHostLabel(label: string) {
  const trimmed = label.trim().replace(/\s+/g, " ")
  const display = SAME_NAME_PLAYER_DISPLAY_NAMES.get(trimmed)
  const space = trimmed.lastIndexOf(" ")
  const tail = space > 0 ? trimmed.slice(space + 1) : ""
  if (TEAM_TOKEN.test(tail)) {
    return { name: display ?? trimmed.slice(0, space), team: tail }
  }
  return { name: display ?? trimmed, team: null }
}

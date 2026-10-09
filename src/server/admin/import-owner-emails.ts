import { prisma } from "@/lib/prisma"

export type OwnerImportResult = {
  updated: number
  unchanged: number
  unknownTeams: string[]
  invalidLines: string[]
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Lines of "Team name, Owner name, email" (commas or tabs, so a spreadsheet paste
 * works). Each team is attached to the owner with that email, creating the owner if
 * needed, so one person's several teams end up under one owner. Placeholder owners
 * left with no teams are removed.
 */
export async function importOwnerEmails(seasonId: string, text: string): Promise<OwnerImportResult> {
  const entries = await prisma.entry.findMany({
    where: { seasonId },
    select: { id: true, teamName: true, ownerId: true },
  })
  const byTeam = new Map(entries.map((entry) => [entry.teamName.trim().toLowerCase(), entry]))

  const result: OwnerImportResult = { updated: 0, unchanged: 0, unknownTeams: [], invalidLines: [] }
  const previousOwners = new Set<string>()

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue

    const parts = line.split(/\t|,/).map((part) => part.trim())
    if (parts.length < 3) {
      result.invalidLines.push(line)
      continue
    }

    const email = parts[parts.length - 1].toLowerCase()
    const ownerName = parts[parts.length - 2]
    const teamName = parts.slice(0, parts.length - 2).join(", ")

    if (!EMAIL.test(email) || !ownerName || !teamName) {
      if (!/^team/i.test(teamName)) result.invalidLines.push(line) // tolerate a header row
      continue
    }

    const entry = byTeam.get(teamName.toLowerCase())
    if (!entry) {
      result.unknownTeams.push(teamName)
      continue
    }

    const owner = await prisma.owner.upsert({
      where: { email },
      update: { name: ownerName },
      create: { name: ownerName, email },
    })

    if (owner.id === entry.ownerId) {
      result.unchanged += 1
      continue
    }

    previousOwners.add(entry.ownerId)
    await prisma.entry.update({ where: { id: entry.id }, data: { ownerId: owner.id } })
    entry.ownerId = owner.id
    result.updated += 1
  }

  if (previousOwners.size > 0) {
    await prisma.owner.deleteMany({
      where: { id: { in: [...previousOwners] }, entries: { none: {} } },
    })
  }

  return result
}

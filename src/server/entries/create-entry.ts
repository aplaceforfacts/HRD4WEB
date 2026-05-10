import { SubmissionMethod } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { EntrySelection } from "@/types"
import { validateEntry } from "./validate-entry"

type CreateEntryInput = {
  seasonId: string
  ownerName: string
  ownerEmail: string
  selections: EntrySelection[]
}

export async function createEntry(input: CreateEntryInput) {
  const season = await prisma.season.findUnique({
    where: { id: input.seasonId },
    select: { entryStatus: true },
  })

  if (!season) {
    throw new Error("Season not found.")
  }

  if (season.entryStatus !== "OPEN") {
    throw new Error("Entry submissions are closed.")
  }

  const validation = validateEntry(input.selections)
  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "))
  }

  const owner = await prisma.owner.upsert({
    where: { email: input.ownerEmail.toLowerCase() },
    update: { name: input.ownerName.trim() },
    create: {
      name: input.ownerName.trim(),
      email: input.ownerEmail.toLowerCase(),
    },
  })

  const seasonGroups = await prisma.group.findMany({
    where: { seasonId: input.seasonId },
    select: { id: true, code: true },
  })

  const groupIdByCode = new Map(seasonGroups.map((group) => [group.code, group.id]))

  return prisma.entry.create({
    data: {
      seasonId: input.seasonId,
      ownerId: owner.id,
      submissionMethod: SubmissionMethod.SELF_SERVICE,
      submittedAt: new Date(),
      players: {
        create: input.selections.map((selection, index) => ({
          groupId: groupIdByCode.get(selection.groupCode)!,
          playerId: selection.playerId,
          slotNumber: selection.groupCode === "M" ? index + 1 : 1,
        })),
      },
    },
    include: {
      owner: true,
      players: {
        include: {
          player: true,
          group: true,
        },
      },
    },
  })
}

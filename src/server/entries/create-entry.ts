import { Prisma, SubmissionMethod } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { EntrySelection } from "@/types"
import { validateEntry } from "./validate-entry"

type CreateEntryInput = {
  seasonId: string
  teamName: string
  ownerName: string
  ownerEmail: string
  selections: EntrySelection[]
}

export async function createEntry(input: CreateEntryInput) {
  const season = await prisma.season.findUnique({
    where: { id: input.seasonId },
    select: {
      entryStatus: true,
      groups: {
        select: {
          id: true,
          code: true,
          name: true,
          selectionCount: true,
          seasonPlayers: { select: { playerId: true } },
        },
      },
    },
  })

  if (!season) {
    throw new Error("Season not found.")
  }

  if (season.entryStatus !== "OPEN") {
    throw new Error("Entry submissions are closed.")
  }

  const validation = validateEntry(
    input.selections,
    season.groups.map((group) => ({
      code: group.code,
      name: group.name,
      selectionCount: group.selectionCount,
      playerIds: new Set(group.seasonPlayers.map((row) => row.playerId)),
    })),
  )
  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "))
  }

  const teamName = input.teamName.trim()
  const email = input.ownerEmail.trim().toLowerCase()

  // One person can own several teams, so the owner is matched by email and the
  // team name is what must be unique within the season.
  const owner = await prisma.owner.upsert({
    where: { email },
    update: { name: input.ownerName.trim() },
    create: {
      name: input.ownerName.trim(),
      email,
    },
  })

  const groupIdByCode = new Map(season.groups.map((group) => [group.code, group.id]))
  const slotByGroup = new Map<string, number>()

  try {
    return await prisma.entry.create({
      data: {
        seasonId: input.seasonId,
        ownerId: owner.id,
        teamName,
        submissionMethod: SubmissionMethod.SELF_SERVICE,
        submittedAt: new Date(),
        players: {
          create: input.selections.map((selection) => {
            const slotNumber = (slotByGroup.get(selection.groupCode) ?? 0) + 1
            slotByGroup.set(selection.groupCode, slotNumber)
            return {
              groupId: groupIdByCode.get(selection.groupCode)!,
              playerId: selection.playerId,
              slotNumber,
            }
          }),
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(`The team name "${teamName}" is already taken this season. Pick another.`)
    }
    throw error
  }
}

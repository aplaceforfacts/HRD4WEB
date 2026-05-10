import { PaymentStatus, SubmissionMethod } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { applyScoringPeriodWindows } from "@/server/scoring/scoring-period-windows"

const playerToAddSchema = z.object({
  groupCode: z.string().min(1),
  displayOrder: z.number().int(),
  fullName: z.string().min(1),
  mlbTeam: z.string().min(1),
  sourceName: z.string().min(1),
  marAprHomeRuns: z.number().int().min(0),
  pickCount: z.number().int().min(0),
  sourceRow: z.number().int(),
})

const entrySchema = z.object({
  sourceRow: z.number().int(),
  entryName: z.string().min(1),
  selections: z.array(z.string().min(1)),
})

export const batchIngestPayloadSchema = z.object({
  seasonYear: z.number().int(),
  skipSourceRows: z.array(z.number().int()).default([]),
  playersToAdd: z.array(playerToAddSchema).default([]),
  entries: z.array(entrySchema).default([]),
  normalizationsApplied: z
    .array(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        reason: z.string().optional(),
      }),
    )
    .default([]),
  notes: z.array(z.string()).default([]),
})

type BatchIngestPayload = z.infer<typeof batchIngestPayloadSchema>

type ResolvedSelection = {
  groupCode: string
  playerId: string
  playerName: string
  slotNumber: number
  raw: string
}

type PlayerOption = {
  id: string
  fullName: string
  mlbTeam: string | null
  groupCode: string
}

const NAME_ALIASES = new Map<string, string>([
  ["vinnie pasquantiono", "vinnie pasquantino"],
  ["brett batty", "brett baty"],
  ["jazz chisholm", "jazz chisholm jr"],
  ["luis robert", "luis robert jr"],
  ["nicholas castellanos", "nick castellanos"],
  ["yanier diaz", "yainer diaz"],
  ["sung mun song", "ha-seong kim"],
  ["zach mckinstery", "zach mckinstry"],
  ["jarred kelenk", "jarred kelenic"],
])

const SAME_NAME_PLAYER_DISPLAY_NAMES = new Map<string, string>([
  ["Max Muncy A's", "Max Muncy (A's)"],
])

function getStoredPlayerName(sourceName: string, fullName: string) {
  return SAME_NAME_PLAYER_DISPLAY_NAMES.get(sourceName) ?? fullName
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-‐‑‒–—]/g, " ")
    .replace(/[.’']/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function normalizeName(value: string) {
  const normalized = normalizeText(value)
  return NAME_ALIASES.get(normalized) ?? normalized
}

function normalizedPlayerKeys(player: PlayerOption) {
  const keys = new Set([normalizeName(player.fullName)])

  if (player.mlbTeam) {
    keys.add(normalizeName(`${player.fullName} ${player.mlbTeam}`))
    const withoutParenthetical = player.fullName.replace(/\s+\([^)]*\)$/, "")
    keys.add(normalizeName(withoutParenthetical))
    keys.add(normalizeName(`${withoutParenthetical} ${player.mlbTeam}`))
  }

  return keys
}

function parsePick(raw: string) {
  const trimmed = raw.trim()
  const lastSpace = trimmed.lastIndexOf(" ")

  if (lastSpace === -1) {
    return { name: trimmed, team: "" }
  }

  return {
    name: trimmed.slice(0, lastSpace).trim(),
    team: trimmed.slice(lastSpace + 1).trim(),
  }
}

function generatedOwnerEmail(seasonYear: number, sourceRow: number) {
  return `hrd-import-${seasonYear}-row-${sourceRow}@example.local`
}

function sameSelectionSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  const normalize = (values: string[]) => values.slice().sort().join("|")
  return normalize(left) === normalize(right)
}

function createPlayerResolver(players: PlayerOption[], payload: BatchIngestPayload) {
  const explicitAliases = new Map<string, string>()

  for (const normalization of payload.normalizationsApplied) {
    explicitAliases.set(normalizeText(parsePick(normalization.from).name), normalizeText(parsePick(normalization.to).name))
  }

  function normalizedInputName(rawName: string) {
    const base = normalizeName(rawName)
    return explicitAliases.get(base) ?? base
  }

  return (groupCode: string, rawPick: string) => {
    const pick = parsePick(rawPick)
    const wantedName = normalizedInputName(pick.name)
    const wantedTeam = normalizeText(pick.team)
    const groupPlayers = players.filter((player) => player.groupCode === groupCode)

    const exactNameAndTeam = groupPlayers.find(
      (player) =>
        normalizedPlayerKeys(player).has(wantedName) &&
        (!wantedTeam || normalizeText(player.mlbTeam ?? "") === wantedTeam),
    )
    if (exactNameAndTeam) return exactNameAndTeam

    const exactName = groupPlayers.filter((player) => normalizedPlayerKeys(player).has(wantedName))
    if (exactName.length === 1) return exactName[0]

    return null
  }
}

function expectedGroupCodes(selectionCounts: Map<string, number>) {
  return Array.from(selectionCounts.entries()).flatMap(([code, count]) =>
    Array.from({ length: count }, () => code),
  )
}

async function loadSeasonContext(seasonYear: number) {
  const season = await prisma.season.findUnique({
    where: { year: seasonYear },
    include: {
      groups: {
        include: {
          seasonPlayers: {
            include: { player: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      scoringPeriods: true,
    },
  })

  if (!season) throw new Error(`Season ${seasonYear} not found.`)

  const selectionCounts = new Map(season.groups.map((group) => [group.code, group.selectionCount]))
  const players = season.groups.flatMap((group) =>
    group.seasonPlayers.map((row) => ({
      id: row.playerId,
      fullName: row.player.fullName,
      mlbTeam: row.player.mlbTeam,
      groupCode: group.code,
    })),
  )

  return { season, selectionCounts, players }
}

async function ensurePlayersToAdd(payload: BatchIngestPayload, commit: boolean) {
  const { season } = await loadSeasonContext(payload.seasonYear)
  const groups = new Map(season.groups.map((group) => [group.code, group]))
  const marAprPeriod = season.scoringPeriods.find((period) => period.label === "Mar/Apr")

  const added: string[] = []
  const skipped: string[] = []

  for (const playerInput of payload.playersToAdd) {
    const group = groups.get(playerInput.groupCode)
    if (!group) throw new Error(`Group ${playerInput.groupCode} not found.`)

    const existingSeasonPlayer = group.seasonPlayers.find(
      (row) => normalizeName(row.player.fullName) === normalizeName(getStoredPlayerName(playerInput.sourceName, playerInput.fullName)),
    )

    if (existingSeasonPlayer) {
      skipped.push(playerInput.sourceName)
      continue
    }

    added.push(playerInput.sourceName)

    if (!commit) continue

    await prisma.$transaction(async (tx) => {
      const player = await tx.player.upsert({
        where: { fullName: getStoredPlayerName(playerInput.sourceName, playerInput.fullName) },
        update: {
          mlbTeam: playerInput.mlbTeam,
          isActive: true,
        },
        create: {
          fullName: getStoredPlayerName(playerInput.sourceName, playerInput.fullName),
          mlbTeam: playerInput.mlbTeam,
          isActive: true,
        },
      })

      await tx.seasonPlayerGroup.upsert({
        where: {
          seasonId_playerId: {
            seasonId: season.id,
            playerId: player.id,
          },
        },
        update: {
          groupId: group.id,
          displayOrder: playerInput.displayOrder,
          notes: `Batch ingest source row ${playerInput.sourceRow}; picked ${playerInput.pickCount}x.`,
        },
        create: {
          seasonId: season.id,
          groupId: group.id,
          playerId: player.id,
          displayOrder: playerInput.displayOrder,
          notes: `Batch ingest source row ${playerInput.sourceRow}; picked ${playerInput.pickCount}x.`,
        },
      })

      if (marAprPeriod) {
        const marAprSnapshotDate = new Date(marAprPeriod.endDate.getTime() - 1)

        await tx.playerStatSnapshot.upsert({
          where: {
            seasonId_playerId_snapshotDate: {
              seasonId: season.id,
              playerId: player.id,
              snapshotDate: marAprSnapshotDate,
            },
          },
          update: {
            teamCode: playerInput.mlbTeam,
            homeRuns: playerInput.marAprHomeRuns,
            sourceName: "batch-ingest",
          },
          create: {
            seasonId: season.id,
            playerId: player.id,
            snapshotDate: marAprSnapshotDate,
            teamCode: playerInput.mlbTeam,
            homeRuns: playerInput.marAprHomeRuns,
            sourceName: "batch-ingest",
          },
        })
      }
    })
  }

  return { added, skipped }
}

async function resolveEntries(payload: BatchIngestPayload, includeVirtualPlayers: boolean) {
  const { season, selectionCounts, players } = await loadSeasonContext(payload.seasonYear)
  const playerOptions = [...players]

  if (includeVirtualPlayers) {
    for (const player of payload.playersToAdd) {
      if (
        !playerOptions.some(
          (option) =>
            option.groupCode === player.groupCode &&
            normalizeName(option.fullName) === normalizeName(getStoredPlayerName(player.sourceName, player.fullName)),
        )
      ) {
        playerOptions.push({
          id: `dry-run:${player.groupCode}:${player.fullName}`,
          fullName: getStoredPlayerName(player.sourceName, player.fullName),
          mlbTeam: player.mlbTeam,
          groupCode: player.groupCode,
        })
      }
    }
  }

  const expectedCodes = expectedGroupCodes(selectionCounts)
  const resolvePlayer = createPlayerResolver(playerOptions, payload)

  const unresolvedPlayers: Array<{ sourceRow: number; entryName: string; groupCode: string; pick: string }> = []
  const invalidEntries: Array<{ sourceRow: number; entryName: string; message: string }> = []
  const resolvedEntries: Array<{
    sourceRow: number
    entryName: string
    ownerEmail: string
    selections: ResolvedSelection[]
    rawSelections: string[]
  }> = []

  for (const entry of payload.entries) {
    if (payload.skipSourceRows.includes(entry.sourceRow)) continue

    if (entry.selections.length !== expectedCodes.length) {
      invalidEntries.push({
        sourceRow: entry.sourceRow,
        entryName: entry.entryName,
        message: `Expected ${expectedCodes.length} selections but received ${entry.selections.length}.`,
      })
      continue
    }

    const selections: ResolvedSelection[] = []

    for (const [index, rawPick] of entry.selections.entries()) {
      const groupCode = expectedCodes[index]
      const player = resolvePlayer(groupCode, rawPick)

      if (!player) {
        unresolvedPlayers.push({ sourceRow: entry.sourceRow, entryName: entry.entryName, groupCode, pick: rawPick })
        continue
      }

      const slotNumber = groupCode === "M" ? selections.filter((selection) => selection.groupCode === "M").length + 1 : 1
      selections.push({
        groupCode,
        playerId: player.id,
        playerName: player.fullName,
        slotNumber,
        raw: rawPick,
      })
    }

    if (selections.length === expectedCodes.length) {
      resolvedEntries.push({
        sourceRow: entry.sourceRow,
        entryName: entry.entryName.trim(),
        ownerEmail: generatedOwnerEmail(payload.seasonYear, entry.sourceRow),
        selections,
        rawSelections: entry.selections,
      })
    }
  }

  return { season, resolvedEntries, invalidEntries, unresolvedPlayers }
}

async function findExistingEntry(seasonId: string, ownerEmail: string, ownerName: string, rawSelections: string[]) {
  const direct = await prisma.entry.findFirst({
    where: {
      seasonId,
      owner: { email: ownerEmail },
    },
    include: {
      owner: true,
      players: {
        include: { player: true, group: true },
      },
    },
  })

  if (direct) return direct

  const sameNameEntries = await prisma.entry.findMany({
    where: {
      seasonId,
      owner: { name: ownerName },
    },
    include: {
      owner: true,
      players: {
        include: { player: true, group: true },
      },
    },
  })

  return (
    sameNameEntries.find((entry) =>
      sameSelectionSet(
        entry.players.map((row) => `${row.player.fullName} ${row.player.mlbTeam ?? ""}`.trim()),
        rawSelections,
      ),
    ) ?? null
  )
}

async function createResolvedEntries(
  seasonId: string,
  resolvedEntries: Awaited<ReturnType<typeof resolveEntries>>["resolvedEntries"],
  commit: boolean,
) {
  const created: string[] = []
  const skipped: string[] = []

  const groups = await prisma.group.findMany({
    where: { seasonId },
    select: { id: true, code: true },
  })
  const groupIdByCode = new Map(groups.map((group) => [group.code, group.id]))

  for (const entry of resolvedEntries) {
    const existing = await findExistingEntry(seasonId, entry.ownerEmail, entry.entryName, entry.rawSelections)

    if (existing) {
      skipped.push(entry.entryName)
      continue
    }

    created.push(entry.entryName)

    if (!commit) continue

    await prisma.$transaction(async (tx) => {
      const owner = await tx.owner.upsert({
        where: { email: entry.ownerEmail },
        update: { name: entry.entryName },
        create: {
          name: entry.entryName,
          email: entry.ownerEmail,
        },
      })

      await tx.entry.create({
        data: {
          seasonId,
          ownerId: owner.id,
          submissionMethod: SubmissionMethod.IMPORTED,
          submittedAt: new Date(),
          isLocked: true,
          lockedAt: new Date(),
          paymentStatus: PaymentStatus.UNPAID,
          paymentNote: `Batch ingest source row ${entry.sourceRow}`,
          players: {
            create: entry.selections.map((selection) => ({
              groupId: groupIdByCode.get(selection.groupCode)!,
              playerId: selection.playerId,
              slotNumber: selection.slotNumber,
            })),
          },
        },
      })
    })
  }

  return { created, skipped }
}

export async function runBatchIngest(payload: BatchIngestPayload, commit: boolean) {
  const cutoffResult = await applyScoringPeriodWindows(payload.seasonYear, commit)
  const playerResult = await ensurePlayersToAdd(payload, commit)
  const resolved = await resolveEntries(payload, !commit)
  const entryResult = await createResolvedEntries(resolved.season.id, resolved.resolvedEntries, commit)

  const ok =
    resolved.invalidEntries.length === 0 &&
    resolved.unresolvedPlayers.length === 0 &&
    (commit ? true : true)

  return {
    ok,
    mode: commit ? "commit" : "dry-run",
    seasonYear: payload.seasonYear,
    scoringPeriods: cutoffResult,
    players: {
      toAdd: playerResult.added.length,
      addedOrWouldAdd: playerResult.added,
      skippedExisting: playerResult.skipped,
    },
    entries: {
      totalReceived: payload.entries.length,
      resolvable: resolved.resolvedEntries.length,
      createdOrWouldCreate: entryResult.created.length,
      skippedDuplicates: entryResult.skipped.length,
    },
    invalidEntries: resolved.invalidEntries,
    unresolvedPlayers: resolved.unresolvedPlayers,
    skipSourceRows: payload.skipSourceRows,
  }
}

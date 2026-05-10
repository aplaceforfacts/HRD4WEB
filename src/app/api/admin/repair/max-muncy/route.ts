import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function repairMaxMuncy() {
  const season = await prisma.season.findUnique({
    where: { year: 2026 },
    include: { groups: true, scoringPeriods: true },
  })

  if (!season) throw new Error("Season 2026 not found.")

  const groupH = season.groups.find((group) => group.code === "H")
  const groupM = season.groups.find((group) => group.code === "M")
  const marApr = season.scoringPeriods.find((period) => period.label === "Mar/Apr")

  if (!groupH || !groupM) throw new Error("Groups H/M not found.")

  const maxMuncyLad = await prisma.player.upsert({
    where: { fullName: "Max Muncy" },
    update: {
      mlbTeam: "LAD",
      isActive: true,
    },
    create: {
      fullName: "Max Muncy",
      mlbTeam: "LAD",
      isActive: true,
    },
  })

  const maxMuncyAs = await prisma.player.upsert({
    where: { fullName: "Max Muncy (A's)" },
    update: {
      mlbTeam: "A's",
      isActive: true,
    },
    create: {
      fullName: "Max Muncy (A's)",
      mlbTeam: "A's",
      isActive: true,
    },
  })

  await prisma.$transaction(async (tx) => {
    await tx.entryPlayer.updateMany({
      where: {
        groupId: groupM.id,
        playerId: maxMuncyLad.id,
      },
      data: {
        playerId: maxMuncyAs.id,
      },
    })

    await tx.seasonPlayerGroup.upsert({
      where: {
        seasonId_playerId: {
          seasonId: season.id,
          playerId: maxMuncyLad.id,
        },
      },
      update: {
        groupId: groupH.id,
        displayOrder: 7,
        notes: null,
      },
      create: {
        seasonId: season.id,
        groupId: groupH.id,
        playerId: maxMuncyLad.id,
        displayOrder: 7,
      },
    })

    await tx.seasonPlayerGroup.upsert({
      where: {
        seasonId_playerId: {
          seasonId: season.id,
          playerId: maxMuncyAs.id,
        },
      },
      update: {
        groupId: groupM.id,
        displayOrder: 125,
        notes: "Batch ingest source row 319; picked 1x.",
      },
      create: {
        seasonId: season.id,
        groupId: groupM.id,
        playerId: maxMuncyAs.id,
        displayOrder: 125,
        notes: "Batch ingest source row 319; picked 1x.",
      },
    })

    if (marApr) {
      await tx.playerStatSnapshot.upsert({
        where: {
          seasonId_playerId_snapshotDate: {
            seasonId: season.id,
            playerId: maxMuncyAs.id,
            snapshotDate: new Date(marApr.endDate.getTime() - 1),
          },
        },
        update: {
          teamCode: "A's",
          homeRuns: 2,
          sourceName: "batch-ingest-repair",
        },
        create: {
          seasonId: season.id,
          playerId: maxMuncyAs.id,
          snapshotDate: new Date(marApr.endDate.getTime() - 1),
          teamCode: "A's",
          homeRuns: 2,
          sourceName: "batch-ingest-repair",
        },
      })
    }
  })

  return {
    ok: true,
    maxMuncyLadId: maxMuncyLad.id,
    maxMuncyAsId: maxMuncyAs.id,
  }
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (!cronSecret) {
    return NextResponse.json({ ok: false, message: "CRON_SECRET is not configured." }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json(await repairMaxMuncy())
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown repair error"
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}

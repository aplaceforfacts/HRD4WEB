import { prisma } from "@/lib/prisma"

export async function getEntryDetail(entryId: string, periodLabel = "Season") {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: { season: { include: { league: true } } },
  })

  if (!entry) return null

  const scoringPeriod = await prisma.scoringPeriod.findFirst({
    where: {
      seasonId: entry.seasonId,
      label: periodLabel,
    },
  })

  if (!scoringPeriod) return null

  const [players, allScores, optimal] = await Promise.all([
    prisma.entryPlayer.findMany({
      where: { entryId },
      include: {
        group: true,
        player: {
          include: {
            periodStats: { where: { scoringPeriodId: scoringPeriod.id } },
          },
        },
      },
      orderBy: [{ group: { sortOrder: "asc" } }, { slotNumber: "asc" }],
    }),
    prisma.entryPeriodScore.findMany({
      where: {
        seasonId: entry.seasonId,
        scoringPeriodId: scoringPeriod.id,
      },
      orderBy: [{ homeRuns: "desc" }, { entry: { teamName: "asc" } }],
    }),
    prisma.optimalLineup.findFirst({
      where: {
        seasonId: entry.seasonId,
        scoringPeriodId: scoringPeriod.id,
      },
      include: {
        players: {
          include: {
            group: true,
            player: true,
          },
        },
      },
    }),
  ])

  const leader = allScores[0] ?? null
  const myScore = allScores.find((score) => score.entryId === entry.id) ?? null

  const rosterRows = players.map((row, index) => {
    const stat = row.player.periodStats[0]
    return {
      entryPlayerId: row.id,
      slotNumber: row.slotNumber,
      groupCode: row.group.code,
      groupName: row.group.name,
      playerId: row.player.id,
      playerName: row.player.fullName,
      team: row.player.mlbTeam,
      homeRuns: stat?.homeRuns ?? 0,
      rankInGroup: stat?.rankInGroup ?? null,
      isTied: stat?.isTied ?? false,
      order: index,
      multiPick: row.group.selectionCount > 1,
    }
  })

  return {
    entry: {
      id: entry.id,
      teamName: entry.teamName,
      seasonName: entry.season.name,
      seasonYear: entry.season.year,
      leagueSlug: entry.season.league.slug,
    },
    period: scoringPeriod,
    rosterRows,
    myScore,
    leader,
    teamCount: allScores.length,
    optimal,
  }
}

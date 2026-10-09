import { prisma } from "@/lib/prisma"

type GapRow = {
  groupCode: string
  slotNumber: number
  optimalPlayerName: string
  optimalHomeRuns: number
  yourPlayerName: string | null
  yourHomeRuns: number
  gap: number
}

export async function getEntryGapAnalysis(entryId: string, periodLabel = "Season") {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: { id: true, seasonId: true },
  })

  if (!entry) return null

  const scoringPeriod = await prisma.scoringPeriod.findFirst({
    where: {
      seasonId: entry.seasonId,
      label: periodLabel,
    },
  })

  if (!scoringPeriod) return null

  const [players, optimal] = await Promise.all([
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
    }),
    prisma.optimalLineup.findUnique({
      where: { scoringPeriodId: scoringPeriod.id },
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

  if (!optimal) return null

  const byHomeRunsThenName = <T extends { homeRuns: number; name: string }>(a: T, b: T) =>
    b.homeRuns - a.homeRuns || a.name.localeCompare(b.name)

  // Compare group by group: within a multi-pick group (Group M), the owner's best
  // pick lines up against the optimal best, second against second, and so on.
  const groups = new Map<string, { sortOrder: number; mine: Array<{ name: string; homeRuns: number }>; best: typeof optimal.players }>()

  for (const row of optimal.players) {
    const bucket = groups.get(row.group.code) ?? { sortOrder: row.group.sortOrder, mine: [], best: [] }
    bucket.best.push(row)
    groups.set(row.group.code, bucket)
  }

  for (const row of players) {
    const bucket = groups.get(row.group.code)
    if (!bucket) continue
    bucket.mine.push({ name: row.player.fullName, homeRuns: row.player.periodStats[0]?.homeRuns ?? 0 })
  }

  const analysisRows: GapRow[] = [...groups.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .flatMap(([groupCode, bucket]) => {
      const mine = [...bucket.mine].sort(byHomeRunsThenName)
      const best = [...bucket.best]
        .map((row) => ({ ...row, name: row.player.fullName }))
        .sort(byHomeRunsThenName)

      return best.map((optimalRow, index) => {
        const ownPick = mine[index]
        const ownHomeRuns = ownPick?.homeRuns ?? 0

        return {
          groupCode,
          slotNumber: index + 1,
          optimalPlayerName: optimalRow.name,
          optimalHomeRuns: optimalRow.homeRuns,
          yourPlayerName: ownPick?.name ?? null,
          yourHomeRuns: ownHomeRuns,
          gap: optimalRow.homeRuns - ownHomeRuns,
        }
      })
    })

  const totalGap = analysisRows.reduce((sum, row) => sum + Math.max(0, row.gap), 0)

  return {
    totalGap,
    rows: analysisRows,
  }
}

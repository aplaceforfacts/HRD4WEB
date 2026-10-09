import { prisma } from "@/lib/prisma"
import { requireSeasonContext } from "@/server/season/resolve-season"

export const dynamic = "force-dynamic"

export default async function RulesPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>
  searchParams: Promise<{ season?: string }>
}) {
  const { season } = await requireSeasonContext((await params).league, (await searchParams).season)
  const groups = await prisma.group.findMany({ where: { seasonId: season.id }, orderBy: { sortOrder: "asc" } })
  const monthly = season.scoringPeriods.filter((period) => period.periodType === "MONTHLY")
  const singles = groups.filter((group) => group.selectionCount === 1)
  const multis = groups.filter((group) => group.selectionCount > 1)

  return (
    <div className="prose max-w-3xl">
      <h1>Rules</h1>
      <ul>
        {singles.length > 0 ? (
          <li>
            Choose 1 player from each of Groups {singles[0].code} through {singles[singles.length - 1].code}.
          </li>
        ) : null}
        {multis.map((group) => (
          <li key={group.id}>
            Choose {group.selectionCount} players from {group.name}.
          </li>
        ))}
        <li>Only MLB regular-season {season.year} home runs count, by official game date.</li>
        <li>Monthly winners are awarded for {monthly.map((period) => period.label).join(", ")}.</li>
        <li>Ties are allowed. No tiebreakers.</li>
        <li>Every team needs an owner email. That&apos;s where the monthly standings workbook is sent.</li>
      </ul>
    </div>
  )
}

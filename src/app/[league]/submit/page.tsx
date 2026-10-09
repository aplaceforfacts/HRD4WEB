export const dynamic = "force-dynamic"
import { EntryForm } from "@/components/entry-form"
import { getEntryFormSeason } from "@/server/entries/get-entry-form-season"
import { requireSeasonContext } from "@/server/season/resolve-season"

export default async function SubmitPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>
  searchParams: Promise<{ season?: string }>
}) {
  const context = await requireSeasonContext((await params).league, (await searchParams).season)
  const season = await getEntryFormSeason(context.season.id)

  if (!season) {
    return <div>Season not found.</div>
  }

  if (season.entryStatus !== "OPEN") {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Submit Entry</h1>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Entries are closed</h2>
          <p className="mt-2 text-sm text-neutral-600">
            {season.entryStatus === "SETUP"
              ? `Entries for the ${season.year} ${context.league.name} haven't opened yet.`
              : `The ${season.year} ${context.league.name} entry window has closed. You can still view standings, player rankings, and win odds.`}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Submit Entry</h1>
      <EntryForm season={season} />
    </div>
  )
}

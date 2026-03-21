export const dynamic = "force-dynamic"
import { EntryForm } from "@/components/entry-form"
import { getEntryFormSeason } from "@/server/entries/get-entry-form-season"

export default async function SubmitPage() {
  const season = await getEntryFormSeason(2026)

  if (!season) {
    return <div>Season not found.</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Submit Entry</h1>
      <EntryForm season={season} />
    </div>
  )
}

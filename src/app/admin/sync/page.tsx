import { AdminSyncForm } from "./sync-form"

export default function AdminSyncPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Sync</h1>
      <p className="max-w-2xl text-sm text-neutral-600">
        Re-imports every player&apos;s MLB game log for the year, then recalculates player and team totals, ranks,
        optimal lineups and odds for every league playing that year. This is what runs nightly at 5 AM ET.
      </p>
      <AdminSyncForm defaultYear={new Date().getFullYear()} />
    </div>
  )
}

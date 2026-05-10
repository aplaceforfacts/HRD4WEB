import { AdminSyncForm } from "./sync-form"

export default function AdminSyncPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Sync</h1>
      <p className="max-w-2xl text-sm text-neutral-600">
        This recalculates player period stats, entry standings, optimal lineups, and odds from the currently loaded snapshots.
      </p>
      <AdminSyncForm />
    </div>
  )
}

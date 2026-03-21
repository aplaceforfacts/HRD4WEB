export default function AdminSyncPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Sync</h1>
      <form action="/api/admin/sync/run" method="post">
        <button className="rounded-xl border border-neutral-900 bg-neutral-900 px-5 py-2.5 font-medium text-white" type="submit">
          Run scoring sync
        </button>
      </form>
      <p className="text-sm text-neutral-600">
        This recalculates player period stats, entry standings, and optimal lineups from the currently loaded snapshots.
      </p>
    </div>
  )
}

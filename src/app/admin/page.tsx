import { prisma } from "@/lib/prisma"

export default async function AdminPage() {
  const season = await prisma.season.findUnique({
    where: { year: 2026 },
    include: {
      groups: true,
      entries: true,
      scoringPeriods: true,
    },
  })

  if (!season) return <div>Season not found.</div>

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-neutral-500">Season</div>
          <div className="mt-1 text-lg font-semibold">{season.name}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-neutral-500">Groups</div>
          <div className="mt-1 text-lg font-semibold">{season.groups.length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-neutral-500">Entries</div>
          <div className="mt-1 text-lg font-semibold">{season.entries.length}</div>
        </div>
      </div>
    </div>
  )
}

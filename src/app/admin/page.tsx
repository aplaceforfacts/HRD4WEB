import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { isPlaceholderEmail } from "@/server/email/owner-email"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const leagues = await prisma.league.findMany({
    orderBy: { name: "asc" },
    include: {
      seasons: {
        orderBy: { year: "desc" },
        include: { entries: { select: { owner: { select: { email: true } } } } },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Leagues</h1>
        <form method="post" action="/api/admin/logout">
          <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">Sign out</button>
        </form>
      </div>

      {leagues.map((league) => (
        <section key={league.id} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">{league.name}</h2>
            <span className="text-sm text-neutral-500">
              /{league.slug} · monthly emails {league.monthlyExportEnabled ? "on" : "off"}
            </span>
          </div>
          <ul className="grid gap-2 md:grid-cols-3">
            {league.seasons.map((season) => {
              const missing = season.entries.filter((entry) => isPlaceholderEmail(entry.owner.email)).length
              return (
                <li key={season.id}>
                  <Link
                    href={`/admin/${league.slug}/${season.year}`}
                    className="block rounded-xl border border-neutral-200 px-4 py-3 hover:bg-neutral-50"
                  >
                    <div className="font-medium">{season.year}</div>
                    <div className="text-sm text-neutral-600">
                      {season.entries.length} teams · entries {season.entryStatus.toLowerCase()}
                      {missing ? ` · ${missing} need an email` : ""}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <section className="flex flex-wrap gap-3">
        <Link className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium" href="/admin/sync">
          Run sync
        </Link>
        <Link className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium" href="/admin/batch-ingest">
          Batch ingest
        </Link>
      </section>
      <p className="max-w-2xl text-sm text-neutral-500">
        New season or league: run <code>npx tsx scripts/setup-season.ts</code>. See docs/OFFSEASON.md.
      </p>
    </div>
  )
}

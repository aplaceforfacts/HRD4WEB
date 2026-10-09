import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** One league: go straight to it. Several: let the visitor pick. */
export default async function RootPage() {
  const leagues = await prisma.league.findMany({
    where: { seasons: { some: {} } },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  })

  if (leagues.length === 1) redirect(`/${leagues[0].slug}`)

  return (
    <main className="app-shell space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Home Run Derby leagues</h1>
      {leagues.length === 0 ? (
        <p className="text-neutral-600">No leagues have been set up yet.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {leagues.map((league) => (
            <li key={league.slug}>
              <Link
                href={`/${league.slug}`}
                className="block rounded-2xl border border-neutral-200 bg-white p-5 font-semibold shadow-sm hover:bg-neutral-50"
              >
                {league.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

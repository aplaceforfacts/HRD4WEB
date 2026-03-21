import Link from "next/link"
import { EntrySearch } from "@/components/entry-search"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-neutral-200 bg-gradient-to-b from-neutral-50 to-white p-8 shadow-sm md:p-12">
        <div className="max-w-3xl space-y-5">
          <Badge>2026 Season</Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Home Run Derby</h1>
          <p className="text-lg leading-8 text-neutral-700 md:text-xl">
            Pick a 16-player preseason roster and chase the best home run total for the month and the full season.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/submit" className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800">
              Submit Entry
            </Link>
            <Link href="/standings" className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50">
              View Standings
            </Link>
          </div>
          <div className="pt-2">
            <EntrySearch />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-lg font-semibold">16-player entry</h2>
            <p className="text-sm leading-6 text-neutral-600">
              Choose one player from Groups A–L and four players from Group M.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-lg font-semibold">Six monthly races</h2>
            <p className="text-sm leading-6 text-neutral-600">
              March 25–April 30, then May, June, July, August, and September.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-lg font-semibold">Season-long crown</h2>
            <p className="text-sm leading-6 text-neutral-600">
              Only 2026 MLB regular-season home runs count. Ties are allowed.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { leagueHref, type LinkContext } from "@/lib/paths"

type Result = {
  entryId: string
  teamName: string
}

export function EntrySearch({ seasonId, ctx }: { seasonId: string; ctx: LinkContext }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)

  async function handleSearch(value: string) {
    setQuery(value)

    if (value.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    const res = await fetch(
      `/api/public/entries/search?seasonId=${encodeURIComponent(seasonId)}&q=${encodeURIComponent(value)}`,
    )
    const data = await res.json()
    setResults(data)
    setLoading(false)
  }

  return (
    <div className="relative max-w-md">
      <input
        className="w-full rounded-xl border border-neutral-300 px-4 py-2.5"
        placeholder="Search for your team..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {(results.length > 0 || loading) && (
        <div className="absolute z-10 mt-2 w-full rounded-xl border border-neutral-200 bg-white shadow-lg">
          {loading ? (
            <div className="p-3 text-sm text-neutral-500">Searching...</div>
          ) : (
            results.map((r) => (
              <Link key={r.entryId} href={leagueHref(ctx, `/team/${r.entryId}`)} className="block px-4 py-2.5 text-sm hover:bg-neutral-50">
                {r.teamName}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}

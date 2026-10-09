"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { leagueHref } from "@/lib/paths"

type SeasonSummary = { year: number; entriesOpen: boolean }

/** League navigation. Reads ?season= so every link stays on the season being viewed. */
export function SiteHeader({
  leagueSlug,
  leagueName,
  seasons,
  currentYear,
}: {
  leagueSlug: string
  leagueName: string
  /** Newest first. */
  seasons: SeasonSummary[]
  /** The season shown when the URL has no ?season=. */
  currentYear: number
}) {
  const searchParams = useSearchParams()
  const requested = Number(searchParams.get("season"))
  const current = seasons.find((season) => season.year === currentYear) ?? seasons[0]
  const viewing = seasons.find((season) => season.year === requested) ?? current
  const isCurrent = viewing.year === current.year
  const ctx = { leagueSlug, seasonYear: isCurrent ? null : viewing.year }

  const links = [
    { path: "/", label: "Home" },
    { path: "/rules", label: "Rules" },
    ...(viewing.entriesOpen ? [{ path: "/submit", label: "Submit Entry" }] : []),
    { path: "/standings", label: "Standings" },
    { path: "/players", label: "Players" },
    { path: "/optimal", label: "Optimal Lineup" },
    { path: "/odds", label: "Win Probability" },
  ]

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <Link href={leagueHref(ctx, "/")} className="text-xl font-semibold tracking-tight">
            {leagueName}
          </Link>
          <nav className="flex gap-1 text-xs" aria-label="Season">
            {seasons.map((season) => (
              <Link
                key={season.year}
                href={leagueHref({ leagueSlug, seasonYear: season.year === current.year ? null : season.year }, "/standings")}
                className={
                  season.year === viewing.year
                    ? "rounded-full bg-neutral-900 px-2 py-0.5 text-white"
                    : "rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700 hover:bg-neutral-200"
                }
              >
                {season.year}
              </Link>
            ))}
          </nav>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm text-neutral-700">
          {links.map((link) => (
            <Link key={link.path} href={leagueHref(ctx, link.path)} className="hover:text-neutral-900 hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {!isCurrent ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          Viewing the {viewing.year} season.{" "}
          <Link href={leagueHref({ leagueSlug }, "/")} className="font-medium underline">
            Go to the current season
          </Link>
        </div>
      ) : null}
    </header>
  )
}

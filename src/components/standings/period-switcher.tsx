"use client"

import { useRouter, useSearchParams } from "next/navigation"
import SegmentedControl from "@/components/arc/segmented-control/segmented-control"
import { leagueHref, type LinkContext } from "@/lib/paths"

/**
 * Arc segmented control for switching scoring periods. Standings put the period
 * in the path (/standings/may); other pages use ?period=may on their own path.
 */
export function PeriodSwitcher({
  ctx,
  periods,
  current,
  path = "/standings",
  mode = "segment",
}: {
  ctx: LinkContext
  periods: Array<{ label: string; slug: string }>
  current: string
  path?: string
  mode?: "segment" | "query"
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const hrefFor = (slug: string) => {
    if (mode === "segment") return leagueHref(ctx, `${path}/${slug}`)
    const query: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      if (key !== "season") query[key] = value
    })
    return leagueHref(ctx, path, { ...query, period: slug })
  }

  return (
    <SegmentedControl
      label="Scoring period"
      value={current}
      options={periods.map((period) => ({ value: period.slug, label: period.label }))}
      onOptionIntent={(slug) => router.prefetch(hrefFor(slug))}
      onValueChange={(slug) => router.push(hrefFor(slug), { scroll: false })}
    />
  )
}

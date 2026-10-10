"use client"

import { useRouter } from "next/navigation"
import SegmentedControl from "@/components/arc/segmented-control/segmented-control"
import { leagueHref, type LinkContext } from "@/lib/paths"

/** Arc segmented control that navigates between a season's standings periods. */
export function PeriodSwitcher({
  ctx,
  periods,
  current,
}: {
  ctx: LinkContext
  periods: Array<{ label: string; slug: string }>
  current: string
}) {
  const router = useRouter()

  return (
    <SegmentedControl
      label="Scoring period"
      value={current}
      options={periods.map((period) => ({ value: period.slug, label: period.label }))}
      onOptionIntent={(slug) => router.prefetch(leagueHref(ctx, `/standings/${slug}`))}
      onValueChange={(slug) => router.push(leagueHref(ctx, `/standings/${slug}`), { scroll: false })}
    />
  )
}

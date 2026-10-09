export type LinkContext = {
  leagueSlug: string
  /** Set only when viewing a past season, so links stay on that season. */
  seasonYear?: number | null
}

export function linkContext(context: {
  league: { slug: string }
  season: { year: number }
  isCurrent: boolean
}): LinkContext {
  return { leagueSlug: context.league.slug, seasonYear: context.isCurrent ? null : context.season.year }
}

/** League-scoped URL: leagueHref(ctx, "/standings", { period: "may" }) -> /hrd/standings?period=may */
export function leagueHref(
  ctx: LinkContext,
  path: string,
  query: Record<string, string | null | undefined> = {},
) {
  const params = new URLSearchParams()
  if (ctx.seasonYear) params.set("season", String(ctx.seasonYear))
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  const suffix = params.toString()
  const cleanPath = path === "/" ? "" : path
  return `/${ctx.leagueSlug}${cleanPath}${suffix ? `?${suffix}` : ""}`
}

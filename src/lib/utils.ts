export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

export function periodLabelToSlug(label: string) {
  return label.toLowerCase().replace("/", "-")
}

export function slugToPeriodLabel(slug: string) {
  const map: Record<string, string> = {
    season: "Season",
    "mar-apr": "Mar/Apr",
    may: "May",
    june: "June",
    july: "July",
    august: "August",
    september: "September",
  }

  return map[slug] ?? "Season"
}

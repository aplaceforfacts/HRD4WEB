"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

type Period = {
  label: string
  slug: string
}

/** Period switcher that keeps the rest of the query string (e.g. ?season=). */
export function PeriodTabs({ periods, current }: { periods: Period[]; current: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <div className="flex flex-wrap gap-2">
      {periods.map((p) => {
        const isActive = current === p.slug
        const params = new URLSearchParams(searchParams)
        params.set("period", p.slug)

        return (
          <Link
            key={p.slug}
            href={`${pathname}?${params.toString()}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              isActive ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
            )}
          >
            {p.label}
          </Link>
        )
      })}
    </div>
  )
}

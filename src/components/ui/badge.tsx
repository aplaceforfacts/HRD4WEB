import { cn } from "@/lib/utils"

export function Badge({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700",
        className,
      )}
    >
      {children}
    </span>
  )
}

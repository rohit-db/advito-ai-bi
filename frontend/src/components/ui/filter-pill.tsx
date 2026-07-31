import * as React from "react"
import { cn } from "@/lib/utils"

interface FilterPillProps {
  active?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

/**
 * Rounded pill filter button for category/tab filtering (e.g. home feed tabs).
 * DuBois: rounded-full, h-8, active = border-primary bg-primary/5 text-primary.
 * Not a form button — use for visual filter state, not form submission.
 */
function FilterPill({ active, icon, children, onClick, className }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-normal transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary/5 text-primary font-semibold"
          : "border-border bg-background text-foreground hover:bg-secondary",
        className
      )}
    >
      {icon && (
        <span className={cn("flex shrink-0 items-center", active ? "text-primary" : "text-muted-foreground")}>
          {icon}
        </span>
      )}
      {children}
    </button>
  )
}

export { FilterPill }

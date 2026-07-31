import * as React from "react"
import { cn } from "@/lib/utils"

// ─── ListItem ─────────────────────────────────────────────────────────────────
// Selectable panel row: icon + label + optional trailing actions.
// Used in side panels (dataset lists, field lists, file trees, etc.)

interface ListItemProps {
  selected?: boolean
  icon?: React.ReactNode
  actions?: React.ReactNode
  onClick?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

function ListItem({
  selected,
  icon,
  actions,
  onClick,
  children,
  className,
  disabled,
}: ListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex h-8 w-full items-center gap-2 px-3 text-left text-xs transition-colors disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-muted-foreground/10",
        className
      )}
    >
      {icon && (
        <span className={cn("shrink-0", selected ? "text-primary" : "text-muted-foreground")}>
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {actions && (
        <span
          className={cn(
            "shrink-0 transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          {actions}
        </span>
      )}
    </button>
  )
}

export { ListItem }
export type { ListItemProps }

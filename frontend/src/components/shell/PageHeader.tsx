import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StarIcon, StarFillIcon, OverflowIcon } from "@/components/icons"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  /** Breadcrumb nav rendered above the title row */
  breadcrumbs?: React.ReactNode
  /** Page title text or node */
  title: React.ReactNode
  /** Optional 32×32 avatar/icon left of the title (e.g. an AI model icon) */
  avatar?: React.ReactNode
  /** Whether the page is starred/favorited */
  starred?: boolean
  /** Called when the star button is toggled */
  onStarToggle?: () => void
  /** Icon-sized action buttons rendered inline after the title (copy, link, etc.) */
  titleIcons?: React.ReactNode
  /** Badge/tag rendered inline after the title icons (e.g. "Preview") */
  badge?: React.ReactNode
  /** Short description line rendered below the title row */
  description?: React.ReactNode
  /** Right-aligned action buttons (secondary, primary) */
  actions?: React.ReactNode
  /** Renders a standard overflow (⋮) icon button as the first action */
  onOverflow?: () => void
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PageHeader({
  breadcrumbs,
  title,
  avatar,
  starred,
  onStarToggle,
  titleIcons,
  badge,
  description,
  actions,
  onOverflow,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Breadcrumbs row */}
      {breadcrumbs && <div>{breadcrumbs}</div>}

      {/* Title + buttons row */}
      <div className="flex h-8 items-center justify-between gap-4">
        {/* Left: avatar + title + inline icons + badge */}
        <div className="flex min-w-0 items-center gap-2">
          {avatar && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary">
              {avatar}
            </div>
          )}
          <h2 className="shrink-0 text-[22px] font-semibold leading-7 text-foreground whitespace-nowrap">
            {title}
          </h2>
          {onStarToggle && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={starred ? "Remove from favorites" : "Add to favorites"}
              onClick={onStarToggle}
            >
              {starred
                ? <StarFillIcon size={14} className="text-[var(--color-star)] transition-colors" />
                : <StarIcon     size={14} className="text-muted-foreground transition-colors hover:text-[var(--color-star)]" />
              }
            </Button>
          )}
          {titleIcons && (
            <div className="flex items-center gap-0.5">{titleIcons}</div>
          )}
          {badge && <div className="flex items-center">{badge}</div>}
        </div>

        {/* Right: overflow + action buttons */}
        {(onOverflow || actions) && (
          <div className="flex shrink-0 items-center gap-2">
            {onOverflow && (
              <Button variant="ghost" size="icon-sm" aria-label="More options" onClick={onOverflow}>
                <OverflowIcon size={16} className="text-muted-foreground" />
              </Button>
            )}
            {actions}
          </div>
        )}
      </div>

      {/* Description row */}
      {description && (
        <div className="flex items-center gap-1 text-hint text-muted-foreground">
          {description}
        </div>
      )}
    </div>
  )
}

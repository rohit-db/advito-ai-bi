import * as React from "react"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { ChevronDownIcon } from "@/components/icons"
import type { VariantProps } from "class-variance-authority"

interface SplitButtonProps extends VariantProps<typeof buttonVariants> {
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  onMenuClick?: React.MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  className?: string
}

function SplitButton({
  children,
  onClick,
  onMenuClick,
  disabled,
  variant = "primary",
  className,
}: SplitButtonProps) {
  if (variant === "default") {
    // Overlap the two buttons by 1px so their shared edge is a single border.
    // hover:z-10 brings the hovered section's full blue border on top of its neighbor.
    return (
      <div
        className={cn(
          "inline-flex rounded",
          disabled && "opacity-40",
          className
        )}
      >
        <Button
          variant="default"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className="relative -mr-px rounded-r-none hover:z-10"
        >
          {children}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onMenuClick}
          disabled={disabled}
          className="relative rounded-l-none px-2 hover:z-10"
          aria-label="More options"
        >
          <ChevronDownIcon size={14} />
        </Button>
      </div>
    )
  }

  // Filled variants (primary, destructive) and ghost/link:
  // use a thin div as divider — no border-l needed on the chevron button.
  const dividerClass =
    variant === "primary" || variant === "destructive"
      ? "bg-white/40"
      : "bg-border"

  return (
    <div className={cn("inline-flex", className)}>
      <Button
        variant={variant}
        size="sm"
        onClick={onClick}
        disabled={disabled}
        className="rounded-r-none"
      >
        {children}
      </Button>
      <div className={cn("w-px self-stretch", dividerClass)} />
      <Button
        variant={variant}
        size="sm"
        onClick={onMenuClick}
        disabled={disabled}
        className="rounded-l-none px-2"
        aria-label="More options"
      >
        <ChevronDownIcon size={14} />
      </Button>
    </div>
  )
}

export { SplitButton }

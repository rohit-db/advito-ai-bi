import * as React from "react"
import { cn } from "@/lib/utils"

// DuBois RadioTile: card-style radio button with optional icon and description
// Border 1px actionDefaultBorderDefault, padding 16px, gap 4px, 4px radius
// Hover: actionDefaultBackgroundHover bg + actionDefaultBorderHover border

interface RadioTileGroupProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

const RadioTileGroupContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
}>({})

function RadioTileGroup({
  value,
  onValueChange,
  children,
  className,
}: RadioTileGroupProps) {
  return (
    <RadioTileGroupContext.Provider value={{ value, onValueChange }}>
      <div
        data-slot="radio-tile-group"
        role="radiogroup"
        className={cn("flex flex-wrap gap-2", className)}
      >
        {children}
      </div>
    </RadioTileGroupContext.Provider>
  )
}

interface RadioTileProps {
  value: string
  label: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
  className?: string
}

function RadioTile({
  value,
  label,
  description,
  icon,
  disabled,
  className,
}: RadioTileProps) {
  const { value: groupValue, onValueChange } = React.useContext(RadioTileGroupContext)
  const checked = groupValue === value

  return (
    <button
      data-slot="radio-tile"
      role="radio"
      type="button"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onValueChange?.(value)
      }}
      className={cn(
        // DuBois: border, padding md (16px), gap xs (4px), borderRadiusSm (4px), transparent bg
        "flex flex-col items-center border border-border rounded bg-transparent p-4 gap-1 cursor-pointer text-left transition-colors",
        // Hover state: actionDefaultBackgroundHover bg + actionDefaultBorderHover = primary (blue600)
        "hover:bg-[var(--action-default-bg-hover)] hover:border-primary",
        // Active/checked
        checked && "border-primary bg-primary/5",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {/* Top row: icon (left) + radio indicator (right) */}
      <div className="flex w-full items-center justify-between gap-2">
        {icon && (
          <span className={cn("text-muted-foreground", disabled && "opacity-50")}>
            {icon}
          </span>
        )}
        <span className="text-sm font-semibold text-foreground flex-1">{label}</span>
        {/* Radio indicator */}
        <span
          className={cn(
            "size-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
            checked
              ? "border-primary"
              : "border-border",
          )}
        >
          {checked && (
            <span className="size-2 rounded-full bg-primary" />
          )}
        </span>
      </div>
      {/* Description row */}
      {description && (
        <p className="text-hint text-muted-foreground self-start">{description}</p>
      )}
    </button>
  )
}

export { RadioTile, RadioTileGroup }

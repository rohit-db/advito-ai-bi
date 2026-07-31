import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// ─── Context ──────────────────────────────────────────────────────────────────

interface SegmentedControlContextValue {
  value: string
  onValueChange: (value: string) => void
}

const SegmentedControlContext = React.createContext<SegmentedControlContextValue | null>(null)

function useSegmentedControl() {
  const ctx = React.useContext(SegmentedControlContext)
  if (!ctx) throw new Error("SegmentedItem must be used within SegmentedControl")
  return ctx
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface SegmentedControlProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

function SegmentedControl({ value, onValueChange, children, className }: SegmentedControlProps) {
  return (
    <SegmentedControlContext.Provider value={{ value, onValueChange }}>
      <div role="group" className={cn("inline-flex w-fit -space-x-px", className)}>
        {children}
      </div>
    </SegmentedControlContext.Provider>
  )
}

// ─── Item ─────────────────────────────────────────────────────────────────────

interface SegmentedItemProps {
  value: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

function SegmentedItem({ value, children, className, disabled }: SegmentedItemProps) {
  const { value: selectedValue, onValueChange } = useSegmentedControl()
  const isActive = selectedValue === value

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={cn(
        "rounded-none border-border first:rounded-l last:rounded-r",
        isActive
          ? "relative z-10 border-primary bg-primary/5 text-primary font-semibold hover:bg-primary/5 hover:text-primary"
          : "bg-background hover:relative hover:z-[1] hover:bg-secondary",
        className
      )}
    >
      {children}
    </Button>
  )
}

export { SegmentedControl, SegmentedItem }

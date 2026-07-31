import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface HeroSearchProps {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
}

/**
 * Large hero-style search input for home/landing pages.
 * DuBois: h-10, rounded-full, built-in search icon + ⌘P kbd hint.
 * Distinct from the standard 32px form Input — not for use in forms.
 */
function HeroSearch({ value, onChange, placeholder = "Search...", className }: HeroSearchProps) {
  return (
    <div className={cn("relative w-full max-w-[576px]", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "h-12 w-full rounded-full border border-border bg-background pl-10 pr-20 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "outline-none transition-[border-color,box-shadow]",
          "hover:border-primary focus:border-ring focus:ring-[2px] focus:ring-ring",
        )}
      />
      <kbd className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none text-xs text-muted-foreground">
        ⌘ + P
      </kbd>
    </div>
  )
}

export { HeroSearch }

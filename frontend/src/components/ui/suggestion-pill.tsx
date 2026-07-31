import * as React from "react"
import { cn } from "@/lib/utils"

interface SuggestionPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function SuggestionPill({ children, className, onMouseEnter, onMouseLeave, ...props }: SuggestionPillProps) {
  const [hovered, setHovered] = React.useState(false)

  return (
    <button
      className={cn(
        // Shape — sharp top-left corner creates the speech-bubble pointer effect
        "rounded-tl-none rounded-tr-full rounded-br-full rounded-bl-full",
        // Base
        "text-foreground text-[13px] leading-5 px-4 py-2",
        "cursor-pointer transition-[background] duration-150",
        className,
      )}
      style={hovered ? {
        background: "linear-gradient(135deg, rgba(66,153,224,0.15) 20.5%, rgba(202,66,224,0.15) 46.91%, rgba(255,95,70,0.15) 79.5%)",
      } : {
        background: "var(--secondary)",
      }}
      onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e) }}
      onMouseLeave={(e) => { setHovered(false); onMouseLeave?.(e) }}
      {...props}
    >
      {children}
    </button>
  )
}

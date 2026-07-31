import * as React from "react"
import { cn } from "@/lib/utils"

// DuBois Hint: helper text below form fields — 12px/16px, textSecondary color
function Hint({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="hint"
      className={cn("text-hint text-muted-foreground block", className)}
      {...props}
    />
  )
}

export { Hint }

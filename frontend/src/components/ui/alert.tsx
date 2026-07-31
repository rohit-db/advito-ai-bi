import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const alertVariants = cva(
  "w-full rounded border px-3 py-2 text-sm flex items-start gap-2",
  {
    variants: {
      variant: {
        default:
          "border-border bg-accent text-foreground [&>svg]:text-primary",
        destructive:
          "border-[var(--border-danger)] bg-[var(--background-danger)] text-destructive [&>svg]:text-destructive",
        warning:
          "border-[var(--border-warning)] bg-[var(--background-warning)] text-[var(--warning)] [&>svg]:text-[var(--warning)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Grid classes stay on the inner content wrapper so [&>svg] targets the icon correctly
const contentGrid =
  "flex-1 grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-2 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current min-w-0"

interface AlertProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof alertVariants> {
  /** Renders below the description, inside the text column */
  action?: React.ReactNode
  /** Renders to the right of the text column, vertically centered */
  rightAction?: React.ReactNode
  onDismiss?: () => void
}

function Alert({
  className,
  variant,
  action,
  rightAction,
  onDismiss,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <div className={contentGrid}>
        {children}
        {action && <div className="col-start-2 mt-2">{action}</div>}
      </div>

      {rightAction && (
        <div className="flex items-center self-stretch shrink-0">
          {rightAction}
        </div>
      )}

      {onDismiss && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 self-start opacity-60 hover:opacity-100 text-current"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 font-semibold", className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 text-sm", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }

import * as React from "react"
import { CheckIcon, DangerIcon, WarningIcon, LoadingIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

// DuBois Stepper: step progress indicator, horizontal/vertical, 5 statuses
// Icon circle: 32px (DEFAULT_SPACING_UNIT*4 = 8*4), full radius
// Gap between steps (horizontal): 8px, (vertical): 4px
// Divider (horizontal): 1px h, min-w 16px; (vertical): 1px w, min-h 24px, ml-4

export type StepStatus = "upcoming" | "completed" | "loading" | "error" | "warning"

export interface Step {
  title: React.ReactNode
  description?: React.ReactNode
  status?: StepStatus
}

export interface StepperProps {
  steps: Step[]
  currentStepIndex?: number
  direction?: "horizontal" | "vertical"
  className?: string
}

function getStepStyle(status: StepStatus | undefined, isCurrent: boolean) {
  switch (status) {
    case "completed":
      return {
        iconBg: isCurrent ? "bg-primary" : "bg-blue-100 dark:bg-blue-900",
        iconText: isCurrent ? "text-white" : "text-primary",
        iconBorder: "border border-[var(--action-default-bg-press)]",
        titleColor: "text-primary font-semibold",
        descColor: "text-muted-foreground",
        icon: <CheckIcon size={16} />,
      }
    case "error":
      return {
        iconBg: isCurrent ? "bg-destructive" : "bg-[var(--background-danger)]",
        iconText: isCurrent ? "text-white" : "text-destructive",
        iconBorder: "border border-[var(--border-danger)]",
        titleColor: "text-destructive font-semibold",
        descColor: "text-destructive",
        icon: <DangerIcon size={16} />,
      }
    case "warning":
      return {
        iconBg: isCurrent ? "bg-[var(--warning)]" : "bg-[var(--background-warning)]",
        iconText: isCurrent ? "text-white" : "text-[var(--warning)]",
        iconBorder: "border border-[var(--border-warning)]",
        titleColor: "text-[var(--warning)] font-semibold",
        descColor: "text-[var(--warning)]",
        icon: <WarningIcon size={16} />,
      }
    case "loading":
      return {
        iconBg: "",
        iconText: "text-muted-foreground",
        iconBorder: "",
        titleColor: isCurrent ? "text-foreground font-semibold" : "text-muted-foreground",
        descColor: "text-muted-foreground",
        icon: <LoadingIcon size={16} className="animate-spin" style={{ animation: "dubois-spin 1s steps(60, end) infinite" }} />,
      }
    default: // upcoming
      if (isCurrent) {
        return {
          iconBg: "bg-primary",
          iconText: "text-white",
          iconBorder: "",
          titleColor: "text-primary font-semibold",
          descColor: "text-foreground",
          icon: null,
        }
      }
      return {
        iconBg: "",
        iconText: "text-muted-foreground",
        iconBorder: "border border-border",
        titleColor: "text-muted-foreground",
        descColor: "text-muted-foreground",
        icon: null,
      }
  }
}

export function Stepper({
  steps,
  currentStepIndex = 0,
  direction = "horizontal",
  className,
}: StepperProps) {
  if (steps.length === 0) return null

  const isHorizontal = direction === "horizontal"
  const currentIdx = Math.min(steps.length - 1, Math.max(0, currentStepIndex))

  return (
    <ol
      data-slot="stepper"
      className={cn(
        "flex m-0 p-0 list-none w-full",
        // DuBois: gap-2 (8px) horizontal, gap-1 (4px) vertical
        isHorizontal ? "flex-row flex-wrap items-start gap-2" : "flex-col items-start gap-1",
        className
      )}
    >
      {steps.map((step, index) => {
        const isCurrent = index === currentIdx
        const isLast = index === steps.length - 1
        const style = getStepStyle(step.status, isCurrent)
        const isCompleted = step.status === "completed"

        return (
          <li
            key={index}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              isHorizontal ? (isLast ? "flex-none" : "flex-1") : "w-full"
            )}
          >
            {/* Grid layout — horizontal: [icon, title, divider] / vertical: [icon, title] */}
            <div
              className={cn(
                "grid items-center gap-x-2 w-full",
                isHorizontal
                  ? "grid-cols-[32px_max-content_1fr] grid-rows-[32px_auto]"
                  : "grid-cols-[32px_1fr] gap-y-1"
              )}
            >
              {/* Icon circle — 32px, full radius */}
              <div
                className={cn(
                  "size-8 rounded-full flex items-center justify-center text-sm shrink-0 box-border",
                  style.iconBg,
                  style.iconText,
                  style.iconBorder
                )}
              >
                {style.icon ?? (
                  <span className="font-semibold text-xs">{index + 1}</span>
                )}
              </div>

              {/* Title */}
              <span className={cn("text-sm whitespace-nowrap", style.titleColor)}>
                {step.title}
              </span>

              {/* Horizontal divider — spans the remaining column */}
              {isHorizontal && !isLast && (
                <div
                  className={cn(
                    "h-px w-full min-w-4",
                    isCompleted ? "bg-primary" : "bg-border"
                  )}
                />
              )}

              {/* Description — col 2 in horizontal, col 2 in vertical */}
              {step.description && (
                <p
                  className={cn(
                    "text-hint m-0",
                    isHorizontal ? "col-start-2 col-span-2 max-w-[140px]" : "col-start-2",
                    style.descColor
                  )}
                >
                  {step.description}
                </p>
              )}

              {/* Vertical divider */}
              {!isHorizontal && !isLast && (
                <div
                  className={cn(
                    "w-px min-h-6 self-start ml-4 col-start-1",
                    isCompleted ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

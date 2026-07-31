import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  PlayIcon, TrashIcon, OverflowIcon, FullscreenIcon,
} from "@/components/icons"
import { SparkleDoubleFillIcon } from "@/components/icons"
import { DbIcon } from "@/components/ui/db-icon"

// ─── Types ────────────────────────────────────────────────────────────────────

export type CellLanguage = "Python" | "SQL" | "Markdown" | "Scala" | "R"

export interface NotebookCellProps {
  language?: CellLanguage
  lineCount?: number
  /** Sample code lines to show in the editor area */
  code?: string[]
  onRun?: () => void
  onDelete?: () => void
  onExpand?: () => void
  className?: string
  children?: React.ReactNode
}

// ─── Language colors ──────────────────────────────────────────────────────────

const LANG_COLOR: Record<CellLanguage, string> = {
  Python:   "text-blue-500",
  SQL:      "text-orange-500",
  Markdown: "text-green-600",
  Scala:    "text-red-500",
  R:        "text-purple-500",
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotebookCell({
  language = "Python",
  lineCount = 3,
  code,
  onRun,
  onDelete,
  onExpand,
  className,
  children,
}: NotebookCellProps) {
  const lines = code ?? Array.from({ length: lineCount }, (_, i) => i === 0 ? "" : "")

  return (
    <div
      className={cn(
        "group/cell rounded-md border border-border bg-background overflow-hidden",
        className
      )}
    >
      {/* ── Cell body ── */}
      <div className="flex">

        {/* Left gutter: run button + line numbers */}
        <div className="flex w-10 shrink-0 flex-col items-center border-r border-border bg-secondary/40">
          {/* Run button — visible on hover */}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Run cell"
            onClick={onRun}
            className="mt-1.5 h-5 w-5 opacity-0 group-hover/cell:opacity-100 transition-opacity"
          >
            <PlayIcon size={10} className="text-muted-foreground" />
          </Button>
          {/* Line numbers */}
          <div className="flex flex-col items-end w-full pt-0.5 pb-2">
            {lines.map((_, i) => (
              <span
                key={i}
                className="w-full pr-2 text-right text-[11px] leading-5 text-muted-foreground/50 select-none font-mono"
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>

        {/* Code area */}
        <div className="flex-1 min-h-[72px]">
          {/* Hover toolbar */}
          <div className="flex items-center justify-between px-3 pt-1.5 pb-0 opacity-0 group-hover/cell:opacity-100 transition-opacity">
            <span className={cn("text-hint font-medium", LANG_COLOR[language])}>{language}</span>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon-xs" aria-label="AI assist">
                <DbIcon icon={SparkleDoubleFillIcon} color="ai" size={12} />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="Expand cell" onClick={onExpand}>
                <FullscreenIcon size={12} className="text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="Delete cell" onClick={onDelete}>
                <TrashIcon size={12} className="text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="More options">
                <OverflowIcon size={12} className="text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Code content */}
          <div className="px-4 pb-4 pt-1.5 font-mono text-sm text-foreground">
            {children ?? (
              <div className="flex flex-col gap-0">
                {lines.map((line, i) => (
                  <div key={i} className="leading-5 text-muted-foreground/30 select-none">
                    {line || "\u00A0"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Cell output area (shown when children include output) ── */}
    </div>
  )
}

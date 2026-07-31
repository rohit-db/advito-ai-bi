import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronRightIcon, ChevronDownIcon } from "@/components/icons"

// ─── Types ────────────────────────────────────────────────────────────────────

export type TreeNodeSize = "default" | "small" | "x-small" | "xx-small"

/**
 * "default" — file-browser style: bg-secondary selected highlight, 2px left border
 * "nav"     — sidebar nav style: bg-primary/10 selected highlight, 3px left border
 */
export type TreeVariant = "default" | "nav"

const SIZE_MAP: Record<TreeNodeSize, { height: string; indent: number }> = {
  "default":  { height: "h-8", indent: 16 },
  "small":    { height: "h-6", indent: 24 },
  "x-small":  { height: "h-6", indent: 16 },
  "xx-small": { height: "h-6", indent: 8  },
}

export interface TreeNode {
  id: string
  label: string
  /** DuBois icon component */
  icon?: React.ComponentType<{ size?: number; className?: string }>
  /** Override icon color class (e.g. "text-blue-400 dark:text-blue-500"). Bypasses selection-based coloring. */
  iconClassName?: string
  children?: TreeNode[]
  defaultExpanded?: boolean
}

interface TreeProps {
  nodes: TreeNode[]
  selectedId?: string
  onSelect?: (id: string) => void
  size?: TreeNodeSize
  variant?: TreeVariant
  className?: string
}

interface TreeNodeItemProps {
  node: TreeNode
  depth: number
  selectedId?: string
  onSelect?: (id: string) => void
  size: TreeNodeSize
  variant: TreeVariant
}

// ─── TreeNodeItem ─────────────────────────────────────────────────────────────

function TreeNodeItem({ node, depth, selectedId, onSelect, size, variant }: TreeNodeItemProps) {
  const [expanded, setExpanded] = React.useState(node.defaultExpanded ?? false)
  const hasChildren = !!node.children?.length
  const isSelected = node.id === selectedId
  const Icon = node.icon
  const { height, indent } = SIZE_MAP[size]

  // Selected row background differs by variant
  const selectedBg = variant === "nav" ? "bg-primary/10" : "bg-secondary"

  return (
    <div>
      {/* Row */}
      <button
        onClick={() => {
          onSelect?.(node.id)
          if (hasChildren) setExpanded((v) => !v)
        }}
        className={cn(
          "group relative flex w-full items-center gap-1 pr-2 text-left text-sm transition-colors",
          height,
          "hover:bg-[var(--action-default-bg-hover)]",
          isSelected && selectedBg,
        )}
        style={{ paddingLeft: `${8 + depth * indent}px` }}
      >
        {/* Selected left border — 3px for nav, 2px for default */}
        {isSelected && (
          <span className={cn(
            "absolute left-0 top-0 h-full bg-primary",
            variant === "nav" ? "w-[3px] rounded-r-sm" : "w-0.5 rounded-full"
          )} />
        )}

        {/* Chevron slot — always 16px wide so icons align at every depth */}
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {hasChildren ? (
            expanded
              ? <ChevronDownIcon  size={12} className="text-muted-foreground" />
              : <ChevronRightIcon size={12} className="text-muted-foreground" />
          ) : null}
        </span>

        {/* Icon */}
        {Icon && (
          <Icon
            size={14}
            className={cn(
              "shrink-0",
              node.iconClassName ?? (isSelected ? "text-primary" : "text-muted-foreground")
            )}
          />
        )}

        {/* Label */}
        <span
          className={cn(
            "truncate",
            isSelected ? "font-semibold text-foreground" : "text-foreground"
          )}
        >
          {node.label}
        </span>
      </button>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              size={size}
              variant={variant}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tree ─────────────────────────────────────────────────────────────────────

export function Tree({
  nodes,
  selectedId,
  onSelect,
  size = "default",
  variant = "default",
  className,
}: TreeProps) {
  return (
    <div role="tree" className={cn("w-full select-none", className)}>
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          size={size}
          variant={variant}
        />
      ))}
    </div>
  )
}

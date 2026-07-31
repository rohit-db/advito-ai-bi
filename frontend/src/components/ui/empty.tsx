import * as React from "react"
import { cn } from "@/lib/utils"
import { ListIcon } from "@/components/icons"

// Matches production DuBois Empty component:
// - Centered flex column, max-w-[600px]
// - image: 64px icon in actionDisabledText color (muted-foreground); default = ListIcon (matches production)
// - title: h3 style, textSecondary (muted-foreground), no top/bottom margin
// - description: paragraph, textSecondary (muted-foreground), mb-4 (spacing.md)
// - button: action slot below description

export interface EmptyProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Custom image/icon slot. Defaults to InboxIcon at 64px. */
  image?: React.ReactNode
  title?: React.ReactNode
  description: React.ReactNode
  /** Action button(s) below the description */
  action?: React.ReactNode
}

function Empty({
  image,
  title,
  description,
  action,
  className,
  ...props
}: EmptyProps) {
  return (
    <div className={cn("flex justify-center w-full", className)} {...props}>
      <div className="flex flex-col items-center text-center max-w-[600px] break-words">
        {/* Image / icon — 64px, muted-foreground (actionDisabledText) */}
        <div className="mb-4 text-muted-foreground [&_svg]:size-16 [&_svg]:shrink-0" role="img">
          {image ?? <ListIcon size={64} />}
        </div>

        {/* Title — h3 typography, muted-foreground */}
        {title && (
          <h3 className="text-lg font-semibold leading-6 text-muted-foreground mt-0 mb-0">
            {title}
          </h3>
        )}

        {/* Description — muted-foreground, mb-4 */}
        <p className="text-sm text-muted-foreground mb-4 mt-1">
          {description}
        </p>

        {/* Action slot */}
        {action}
      </div>
    </div>
  )
}

export { Empty }

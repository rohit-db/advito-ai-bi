import * as React from "react"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const sizeMap: Record<string, string> = {
  small: "size-4",
  default: "size-6",
  large: "size-8",
}

function Spinner({
  className,
  size = "default",
  inheritColor,
  ...props
}: React.ComponentProps<"svg"> & {
  size?: "small" | "default" | "large"
  inheritColor?: boolean
}) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-spin",
        sizeMap[size] ?? sizeMap.default,
        !inheritColor && "text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Spinner }

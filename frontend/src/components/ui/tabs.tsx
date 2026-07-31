import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  // DuBois: 32px height, no internal padding for line variant
  "rounded p-[3px] group-data-[orientation=horizontal]/tabs:h-8 data-[variant=line]:rounded-none data-[variant=line]:p-0 group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center data-[variant=line]:justify-start group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-4 bg-transparent border-b border-input w-full",
        contained: "rounded-none bg-secondary border-b border-border gap-[-1px] p-0 px-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // DuBois: 4px radius (rounded not rounded-md), line variant px-0 flex-none; all tabs semibold (600) per DuBois
        "focus-visible:border-ring focus-visible:ring-ring focus-visible:outline-ring text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded border border-transparent px-2 py-1 text-sm font-semibold whitespace-nowrap transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[2px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // DuBois line: no padding, no radius, no bg, intrinsic width. Trigger padding: 4px top, 8px bottom (spacing.xs/sm)
        "group-data-[variant=line]/tabs-list:px-0 group-data-[variant=line]/tabs-list:pt-1 group-data-[variant=line]/tabs-list:pb-2 group-data-[variant=line]/tabs-list:flex-none group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-0 group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        // DuBois: foreground color for active tab (blue indicator, not blue text); weight stays semibold (all tabs)
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 data-[state=active]:text-foreground",
        // DuBois: blue inset box-shadow indicator for line variant (matches production inset 0 -4px 0 primary)
        // h-full so the 4px shadow sits flush against the list's border-b (no gap)
        "group-data-[variant=line]/tabs-list:h-full group-data-[variant=line]/tabs-list:data-[state=active]:shadow-[inset_0_-4px_0_var(--primary)]",
        // Contained variant: active tab gets white bg + top blue indicator, no focus ring
        "group-data-[variant=contained]/tabs-list:rounded-none group-data-[variant=contained]/tabs-list:border-0 group-data-[variant=contained]/tabs-list:shadow-none group-data-[variant=contained]/tabs-list:h-full group-data-[variant=contained]/tabs-list:focus-visible:ring-0 group-data-[variant=contained]/tabs-list:focus-visible:outline-none group-data-[variant=contained]/tabs-list:focus-visible:border-transparent group-data-[variant=contained]/tabs-list:data-[state=active]:bg-background group-data-[variant=contained]/tabs-list:data-[state=active]:border-0 group-data-[variant=contained]/tabs-list:data-[state=active]:shadow-[inset_0_2px_0_var(--primary)]",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // DuBois base: 4px radius, semibold, 40% disabled opacity, 13px font
  "inline-flex shrink-0 items-center justify-center gap-2 rounded text-sm font-semibold whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-blue-700 active:bg-blue-800",
        destructive:
          "bg-destructive text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        default:
          "border border-input bg-transparent hover:bg-[var(--action-default-bg-hover)] hover:text-blue-700 hover:border-primary dark:border-input dark:hover:bg-[var(--action-default-bg-hover)]",
        ghost:
          "hover:bg-[var(--action-default-bg-hover)] hover:text-blue-700 dark:hover:bg-[var(--action-default-bg-hover)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // DuBois sizes: 32px sm (standard), 24px xs (compact)
        default: "h-8 px-3 has-[>svg]:px-2.5",
        sm: "h-8 px-3 has-[>svg]:px-2.5",
        xs: "h-6 gap-1 px-2 has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-8",
        "icon-sm": "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "sm",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

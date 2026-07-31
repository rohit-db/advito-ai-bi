import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // DuBois: rectangular (rounded 4px), normal weight, 13px/20px (Du Bois/Paragraph), 4px h-padding, no v-padding
  "inline-flex items-center justify-center rounded border border-transparent px-1 py-0 text-sm leading-5 font-normal w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden [&>svg]:pointer-events-none [&>svg]:size-3 transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[2px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        // DuBois categorical tag variants
        default_tag: "bg-[var(--tag-bg-default)] text-[var(--tag-text-default)]",
        charcoal: "bg-[var(--tag-bg-charcoal)] text-[var(--tag-text-charcoal)]",
        lemon: "bg-[var(--tag-bg-lemon)] text-[var(--tag-text-lemon)]",
        lime: "bg-[var(--tag-bg-lime)] text-[var(--tag-text-lime)]",
        teal: "bg-[var(--tag-bg-teal)] text-[var(--tag-text-teal)]",
        turquoise: "bg-[var(--tag-bg-turquoise)] text-[var(--tag-text-turquoise)]",
        indigo: "bg-[var(--tag-bg-indigo)] text-[var(--tag-text-indigo)]",
        purple: "bg-[var(--tag-bg-purple)] text-[var(--tag-text-purple)]",
        pink: "bg-[var(--tag-bg-pink)] text-[var(--tag-text-pink)]",
        coral: "bg-[var(--tag-bg-coral)] text-[var(--tag-text-coral)]",
        brown: "bg-[var(--tag-bg-brown)] text-[var(--tag-text-brown)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  leadingIcon,
  trailingIcon,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    leadingIcon?: React.ReactNode
    trailingIcon?: React.ReactNode
  }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </Comp>
  )
}

export { Badge, badgeVariants }

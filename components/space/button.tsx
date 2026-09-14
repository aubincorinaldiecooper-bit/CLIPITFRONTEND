"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Shadcn Space's button, on Base UI — the presentation direction for the
 * search screens (the owner's call of 2026-09-14: the prototype is the
 * target art direction, and the screens it draws move to Shadcn Space /
 * Base UI as they are touched).
 *
 * The colour names are the workspace scope's "sh" ones — bg-shprimary,
 * bg-shmuted — because inside `.shadcn-scope` those are the paper palette,
 * and the unprefixed names are Astryx's ink everywhere (see the note in
 * app/globals.css).
 *
 * Distinct from components/ui/button.tsx (Radix, the workspace pilot) on
 * purpose. The two compose differently — `render` here, `asChild` there —
 * and moving every workspace screen across at once is not this change.
 * A link is a button with `render={<Link … />}` and `nativeButton={false}`.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-shprimary text-primary-foreground hover:bg-shprimary/80",
        outline:
          "border-shborder bg-background hover:bg-shmuted hover:text-foreground aria-expanded:bg-shmuted aria-expanded:text-foreground",
        secondary:
          "bg-shsecondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-shsecondary aria-expanded:text-secondary-foreground",
        ghost: "hover:bg-shmuted hover:text-foreground aria-expanded:bg-shmuted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-shprimary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-2.5",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)]",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export type ButtonProps = Omit<ButtonPrimitive.Props, "className"> &
  VariantProps<typeof buttonVariants> & { className?: string }

function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

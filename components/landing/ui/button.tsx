"use client"

import type { ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

/**
 * The shadcn Button, as much of it as the landing actually uses.
 *
 * The landing package was written against a shadcn install; this repo's app is
 * built on Astryx and has no shadcn. Rather than bring in shadcn's whole setup
 * — its CSS variables, its Tailwind preset, class-variance-authority and a
 * Radix slot — for one component on one page, this provides exactly the API
 * SchedulePicker asks for: `size="sm"` and `variant` of "default" or
 * "outline".
 *
 * Deliberately NOT exported for use elsewhere. Astryx owns buttons everywhere
 * in the app; this exists so the owner's landing component runs unmodified.
 */

type Variant = "default" | "outline"
type Size = "sm" | "default"

const VARIANT: Record<Variant, string> = {
  default: "bg-[#121212] text-white hover:bg-[#2a2a2a]",
  outline: "bg-white text-[#121212] ring-1 ring-[#e8e5e0] hover:bg-[#f7f5f2]",
}

const SIZE: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[.78rem]",
  default: "h-10 px-4 text-sm",
}

export function Button({
  variant = "default",
  size = "default",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#121212]/40",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  )
}

"use client"

import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

/**
 * A scrolling region.
 *
 * shadcn's version wraps Radix's ScrollArea to get custom scrollbars. The
 * landing uses it for one short list of post times, where the native
 * scrollbar is perfectly good — so this is the plain element rather than
 * another Radix dependency for cosmetics.
 */
export function ScrollArea({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("overflow-y-auto", className)} {...props}>
      {children}
    </div>
  )
}

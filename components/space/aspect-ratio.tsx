import { cn } from "@/lib/utils"

/**
 * Shadcn Space's ratio box: a div that keeps `ratio` (width / height) through
 * the `aspect-ratio` property. React 19 passes `ref` as an ordinary prop, so
 * a caller can hold the element — the moment player does, for fullscreen.
 */
function AspectRatio({ ratio, className, ...props }: React.ComponentProps<"div"> & { ratio: number }) {
  return (
    <div
      data-slot="aspect-ratio"
      style={
        {
          "--ratio": ratio,
        } as React.CSSProperties
      }
      className={cn("relative aspect-(--ratio)", className)}
      {...props}
    />
  )
}

export { AspectRatio }

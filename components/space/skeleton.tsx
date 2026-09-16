import { cn } from "@/lib/utils"

/**
 * Shadcn Space's skeleton: the shape a thing will have, standing where it
 * will stand, while it is still being worked out.
 *
 * It belongs to the Space set rather than the workspace's shadcn/ui one
 * because the search screens are Shadcn Space (the owner, 2026-09-14) and
 * a slot on the results band is search furniture. It wears the pilot's
 * "sh" tokens, so it is only ever drawn inside `.shadcn-scope`.
 *
 * The pulse is information — something is being worked out — so it is not
 * covered by the reduced-motion guard, for the same reason the spinners
 * are not: "Spinners keep turning — they are information, not decoration."
 * What a skeleton must never do is say what it is standing in for. It is a
 * shape, and shapes say nothing; the words above the band do the telling.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-shaccent", className)} {...props} />
}

export { Skeleton }

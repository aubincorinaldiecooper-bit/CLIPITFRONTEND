"use client"

import { useEffect, useState } from "react"

/**
 * A phone, as the search screens mean it: the widths their `max-[860px]:`
 * styles apply at. Tailwind writes that variant as `width < 860px`, so the
 * script-side question is asked the same way — at exactly 860px the styles
 * say wide, and so must the code that sizes what they lay out.
 */
export const PHONE = "(width < 860px)"

/** Matches a media query, SSR-safe (false until mounted). */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const list = window.matchMedia(query)
    setMatches(list.matches)
    const listen = () => setMatches(list.matches)
    list.addEventListener("change", listen)
    return () => list.removeEventListener("change", listen)
  }, [query])

  return matches
}

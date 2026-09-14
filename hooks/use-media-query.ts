"use client"

import { useEffect, useState } from "react"

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

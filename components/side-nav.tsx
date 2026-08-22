"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import Link from "next/link"

/**
 * The left rail: where you are in CLIPIT, and the way to everywhere else.
 *
 * Modeled on the reference sidebar's motion — 224px open, 52px collapsed,
 * one easing for the width and a fade-and-slide for the labels — with the
 * contents replaced by what this product actually has: a new clip, the
 * library of cut clips, and the place publishing will live.
 *
 * Collapsed is remembered per browser. On the theater screen the drawer
 * already owns the right edge, so being able to fold this away is what keeps
 * a laptop screen workable.
 */

const MOTION = {
  expandedWidth: 224,
  collapsedWidth: 52,
  duration: 280,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
}

const COLLAPSED_KEY = "clipit.nav.collapsed"

export type NavDestination = "start" | "clips" | "publishing"

export const NAV_ITEMS: Array<{ key: NavDestination; label: string; href: string; icon: ReactNode }> = [
  {
    key: "start",
    label: "New clip",
    href: "/start",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" />
        <line x1="14.47" y1="14.48" x2="20" y2="20" />
        <line x1="8.12" y1="8.12" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    key: "clips",
    label: "Your clips",
    href: "/clips",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4" />
      </svg>
    ),
  },
  {
    key: "publishing",
    label: "Publishing",
    href: "/publishing",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="2" />
        <path d="M7.76 16.24a6 6 0 0 1 0-8.48M16.24 7.76a6 6 0 0 1 0 8.48M4.93 19.07a10 10 0 0 1 0-14.14M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    ),
  },
]

const CollapseGlyph = ({ flipped = false }: { flipped?: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={flipped ? "rotate-180" : undefined}
  >
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M17 10l-2.5 2L17 14" />
  </svg>
)

export function SideNav({ active }: { active: NavDestination }) {
  const [collapsed, setCollapsed] = useState(false)

  // Read after mount: the server render cannot know this browser's choice,
  // and guessing would make the rail jump on load.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "true")
    } catch {
      // Blocked storage just means the rail starts open. Nothing to do.
    }
  }, [])

  const toggle = () => {
    setCollapsed((current) => {
      const next = !current
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(next))
      } catch {
        // Not remembering the fold is fine; refusing to fold would not be.
      }
      return next
    })
  }

  return (
    <aside
      data-sidebar-collapsed={collapsed}
      aria-label="CLIPIT navigation"
      className="sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r border-white/10 bg-black/20 lg:flex"
      style={{
        width: collapsed ? MOTION.collapsedWidth : MOTION.expandedWidth,
        transition: `width ${MOTION.duration}ms ${MOTION.easing}`,
      } as CSSProperties}
    >
      {/* Fixed inner width so rows keep their shape while the rail animates —
          the reference's trick, and the reason collapsing looks calm. */}
      <div className="flex w-[224px] shrink-0 flex-col py-4">
        <div className="relative mb-4 h-9">
          <Link
            href="/"
            aria-hidden={collapsed}
            tabIndex={collapsed ? -1 : 0}
            className="sidebar-copy absolute left-4 top-1 font-serif text-xl tracking-tight"
          >
            CLIPIT
          </Link>
          <button
            type="button"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={toggle}
            className={`absolute top-0 flex size-9 items-center justify-center rounded-lg text-foreground/40 transition-colors hover:bg-white/5 hover:text-foreground ${collapsed ? "left-1.5" : "right-2"}`}
            style={{ transition: `left ${MOTION.duration}ms ${MOTION.easing}, right ${MOTION.duration}ms ${MOTION.easing}` }}
          >
            <CollapseGlyph flipped={collapsed} />
          </button>
        </div>

        <nav className="flex flex-col gap-px">
          {NAV_ITEMS.map((item) =>
            item.key === "start" ? (
              /* A full navigation on purpose: landing on /start fresh is what
                 resets the theater, so this works even from /start itself. */
              <a
                key={item.key}
                href={item.href}
                title={item.label}
                className={`mx-2 flex h-9 items-center rounded-lg px-2 transition-colors hover:bg-white/5 ${active === item.key ? "bg-white/10 text-foreground" : "text-foreground/60"}`}
              >
                <span className="flex size-5 shrink-0 items-center justify-center">{item.icon}</span>
                <span className="sidebar-copy ml-2 min-w-0 flex-1 truncate text-[13.5px] font-medium">{item.label}</span>
              </a>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                title={item.label}
                className={`mx-2 flex h-9 items-center rounded-lg px-2 transition-colors hover:bg-white/5 ${active === item.key ? "bg-white/10 text-foreground" : "text-foreground/60"}`}
              >
                <span className="flex size-5 shrink-0 items-center justify-center">{item.icon}</span>
                <span className="sidebar-copy ml-2 min-w-0 flex-1 truncate text-[13.5px] font-medium">{item.label}</span>
              </Link>
            ),
          )}
        </nav>
      </div>
    </aside>
  )
}

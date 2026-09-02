"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

export type NotchPosition = "top" | "bottom"

export interface NotchItemData {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  href?: string
  /**
   * A full page load rather than a client-side navigation. For a destination
   * that must start fresh every time — Upload is one: revisiting /start
   * through a client-side link keeps the wizard where it was.
   */
  fullNavigation?: boolean
}

export interface NotchNavProps {
  items: NotchItemData[]
  /** The item for the page being shown, or null on a page the nav does not list. */
  activeId: string | null
  position?: NotchPosition
  logo?: React.ReactNode
  rightContent?: React.ReactNode
  rightCorner?: React.ReactNode
  onActiveChange?: (id: string) => void
  children: React.ReactNode
  className?: string
}

export function NotchNav({
  items,
  activeId,
  position = "top",
  logo,
  rightContent,
  rightCorner,
  onActiveChange,
  children,
  className,
}: NotchNavProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div className={cn("relative min-h-dvh", className)}>
      <div
        // The bar's own height is reserved even when no bar is drawn: the logo
        // and the corner control centre on this box, and with the bar gone it
        // collapsed to nothing and pulled them up past the top of the page
        // (Codex's finding on #78).
        className={cn(
          "fixed inset-x-0 z-(--z-header) flex min-h-14 items-start justify-center px-4",
          position === "top" ? "top-4" : "bottom-4",
        )}
      >
        {logo ? (
          <div className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2">
            {logo}
          </div>
        ) : null}

        {/* A bar with no destinations and nothing else in it is nothing: not
            drawn. One holding actions is still a bar (Devin's finding on #78). */}
        {(items.length > 0 || Boolean(rightContent)) && (
        <nav
          aria-label="Main"
          className="pointer-events-auto flex max-w-[calc(100%-2rem)] items-center gap-1 rounded-full border border-white/10 bg-zinc-950 px-2 py-2 shadow-2xl"
        >
          <div className="flex items-center gap-1" role="tablist">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = item.id === activeId
              const content = (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="notch-active-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-white/15"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                        duration: reducedMotion ? 0 : undefined,
                      }}
                    />
                  )}
                  <Icon className="size-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                  {item.badge ? (
                    <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0 text-[10px] font-semibold text-zinc-300">
                      {item.badge}
                    </span>
                  ) : null}
                </>
              )

              if (item.href) {
                const linkClassName = cn(
                  "relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                  isActive ? "text-white" : "text-zinc-400 hover:text-white",
                )
                if (item.fullNavigation) {
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      data-navigation="full"
                      aria-current={isActive ? "page" : undefined}
                      className={linkClassName}
                    >
                      {content}
                    </a>
                  )
                }
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={linkClassName}
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onActiveChange?.(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                    isActive ? "text-white" : "text-zinc-400 hover:text-white",
                  )}
                >
                  {content}
                </button>
              )
            })}
          </div>

          {rightContent ? (
            <div className="flex shrink-0 items-center gap-1 border-l border-white/10 pl-2 pr-1">
              {rightContent}
            </div>
          ) : null}
        </nav>
        )}

        {rightCorner ? (
          <div className="pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2">
            {rightCorner}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "flex min-h-dvh flex-col",
          position === "top" ? "pt-24" : "pb-24",
        )}
      >
        {children}
      </div>
    </div>
  )
}

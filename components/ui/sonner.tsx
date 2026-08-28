"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * shadcn's Toaster, minus its next-themes dependency: this app has no theme
 * switcher, and the workspace pilot renders shadcn's light look.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

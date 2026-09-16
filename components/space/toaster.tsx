"use client"

import { Toaster as SonnerToaster, toast } from "sonner"

/**
 * Transient notices for the Shadcn Space search screens.
 *
 * The search surface is intentionally light, so keep its toasts light too.
 * This wrapper keeps Sonner out of feature components and gives the search
 * screens one place to tune notification behavior later.
 */
function Toaster() {
  return <SonnerToaster position="top-center" theme="light" toastOptions={{ duration: 2400 }} />
}

export { Toaster, toast }

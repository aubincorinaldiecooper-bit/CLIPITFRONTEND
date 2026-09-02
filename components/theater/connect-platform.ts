"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"
import type { SocialAccount, SocialAccountsPage } from "@/lib/types"

/**
 * Connecting a channel from inside the publish screens, without leaving
 * them. The platform's sign-in opens in a small window; the Publishing
 * page, which the sign-in comes back to, notices it was opened this way,
 * tells this window what happened and closes itself. This hook also asks
 * the account list every few seconds while the window is open, for the
 * case where that message never comes — a sign-in that ended somewhere
 * else, a browser that dropped the opener — and reads "connected" only
 * from the list, never from the message: the list is what the server
 * knows. A window the browser refuses to open falls back to the whole tab
 * going, as the Publishing page does.
 */

export const CONNECT_MESSAGE = "clipit:connect"
export const CONNECT_POLL_MS = 2500
export const CONNECT_WINDOW_NAME = "clipit-connect"
export const CONNECT_WINDOW_FEATURES = "popup=yes,width=560,height=760"

export interface ConnectMessage {
  type: typeof CONNECT_MESSAGE
  ok: boolean
  platform: string | null
  account?: string | null
  /** The backend's connect_error code when not ok. */
  error?: string | null
}

/** The connect_error codes the backend sends back, in words. */
export function connectErrorWords(code: string | null | undefined): string {
  switch (code) {
    case "nothing_new":
      return "That account was already connected — nothing new was added."
    case "subscription_required":
      return "The publishing provider needs a subscription before another account can be connected."
    case "closed":
      return "The sign-in window closed before the channel was connected."
    default:
      return "The sign-in didn't complete. Nothing was connected — try again."
  }
}

export type ConnectPhase = "idle" | "opening" | "waiting" | "connected" | "failed"

export interface ConnectState {
  platform: string | null
  phase: ConnectPhase
  error: string | null
}

const IDLE: ConnectState = { platform: null, phase: "idle", error: null }

export function useConnectPlatform(input: {
  /** A channel that is now connected, with the account list as the server has it. */
  onConnected: (account: SocialAccount, page: SocialAccountsPage) => void
}) {
  const [state, setState] = useState<ConnectState>(IDLE)
  const popup = useRef<Window | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  /** The platform an attempt is running for; null between attempts. */
  const attempt = useRef<string | null>(null)
  /** The accounts connected before the attempt — the new one is the one not among them. */
  const before = useRef<Set<string>>(new Set())
  const onConnected = useRef(input.onConnected)
  onConnected.current = input.onConnected

  const stopAsking = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }, [])

  const finish = useCallback(
    (found: { account: SocialAccount; page: SocialAccountsPage } | null, error: string | null) => {
      stopAsking()
      const platform = attempt.current
      attempt.current = null
      try {
        popup.current?.close()
      } catch {
        // A window already gone, or one the browser will not let go of.
      }
      popup.current = null
      if (found) {
        setState({ platform, phase: "connected", error: null })
        onConnected.current(found.account, found.page)
      } else {
        setState({ platform, phase: "failed", error: error ?? connectErrorWords(null) })
      }
    },
    [stopAsking],
  )

  /** Ask the list; finish when it has a new account for the platform, or when the window is gone. */
  const look = useCallback(async () => {
    const platform = attempt.current
    if (!platform) return
    try {
      const page = await api.listSocialAccounts()
      if (attempt.current !== platform) return
      const fresh = page.accounts.find(
        (account) => account.platform === platform && account.status === "connected" && !before.current.has(account.id),
      )
      if (fresh) finish({ account: fresh, page }, null)
      else if (popup.current?.closed) finish(null, connectErrorWords("closed"))
    } catch {
      // The list did not answer; the next tick asks again.
    }
  }, [finish])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as Partial<ConnectMessage> | null
      if (!data || data.type !== CONNECT_MESSAGE || !attempt.current) return
      if (data.platform && data.platform !== attempt.current) return
      if (data.ok) void look()
      else finish(null, connectErrorWords(data.error))
    }
    window.addEventListener("message", onMessage)
    return () => {
      window.removeEventListener("message", onMessage)
      stopAsking()
    }
  }, [finish, look, stopAsking])

  const connect = useCallback(
    async (platform: string, connected: SocialAccount[]) => {
      if (attempt.current) return
      attempt.current = platform
      before.current = new Set(connected.map((account) => account.id))
      setState({ platform, phase: "opening", error: null })

      // Opened NOW, inside the click: a window opened after an await is a
      // window the browser blocks. It gets its address once the server
      // has minted it.
      let win: Window | null = null
      try {
        win = window.open("about:blank", CONNECT_WINDOW_NAME, CONNECT_WINDOW_FEATURES)
      } catch {
        win = null
      }

      let url: string
      try {
        ;({ url } = await api.getConnectUrl(platform))
      } catch (cause) {
        try {
          win?.close()
        } catch {
          // Nothing to close.
        }
        finish(null, cause instanceof Error ? cause.message : null)
        return
      }
      if (attempt.current !== platform) return

      if (win) {
        try {
          win.location.href = url
        } catch {
          win = null
        }
      }
      if (!win) {
        // Refused a window: the tab goes, and comes back to the Publishing page.
        window.location.assign(url)
        return
      }
      popup.current = win
      setState({ platform, phase: "waiting", error: null })
      stopAsking()
      timer.current = setInterval(() => void look(), CONNECT_POLL_MS)
    },
    [finish, look, stopAsking],
  )

  const dismiss = useCallback(() => setState(IDLE), [])

  return { state, connect, dismiss }
}

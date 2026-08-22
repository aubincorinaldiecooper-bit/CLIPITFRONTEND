"use client"

import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { forgetApiSession } from "@/lib/api"

/**
 * Who you are, in the header.
 *
 * Signed out it offers one thing: type your email, get a sign-in link. No
 * password exists anywhere to be typed, stored or forgotten. Signed in it
 * shows the address and a way out.
 *
 * The form opens as a panel floated under the header, not inside its row — a
 * 300px form in a fixed header row crushes the logo on a phone, and the rule
 * is that nothing reflows when actioned. And on a deployment where sign-in is
 * not configured, this renders nothing at all: a guest-only setup is a
 * supported setup, not one with a broken button in the corner.
 */
export function AccountControl() {
  const { data: session, isPending } = authClient.useSession()
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle")

  // Arriving with #signin (the landing page's Sign in button) opens the
  // panel directly — a Sign in button that lands you somewhere you must find
  // another Sign in button is a broken promise.
  useEffect(() => {
    if (window.location.hash === "#signin") setOpen(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetch("/api/auth-configured")
      .then((response) => response.json() as Promise<{ configured: boolean }>)
      .then((body) => {
        if (!cancelled) setConfigured(body.configured)
      })
      .catch(() => {
        if (!cancelled) setConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Nothing until we know sign-in exists here and whether someone is signed
  // in — flashing "Sign in" at a signed-in person is worse than a beat of
  // empty space.
  if (!configured || isPending) return null

  if (session?.user) {
    return (
      <span className="flex items-center gap-3">
        <span className="hidden max-w-[16rem] truncate text-[13px] text-foreground/50 sm:block">
          {session.user.email}
        </span>
        <button
          type="button"
          onClick={() => {
            void authClient.signOut().finally(() => {
              forgetApiSession()
              window.location.assign("/start")
            })
          }}
          className="whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] text-foreground/70 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-foreground"
        >
          Sign out
        </button>
      </span>
    )
  }

  const send = async () => {
    const address = email.trim()
    if (!address || state === "sending") return
    setState("sending")
    const { error } = await authClient.signIn.magicLink({ email: address, callbackURL: "/start" })
    setState(error ? "failed" : "sent")
  }

  return (
    <span className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] text-foreground/70 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-foreground"
      >
        Sign in
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl bg-black/90 p-3 shadow-xl ring-1 ring-white/15 backdrop-blur">
          {state === "sent" ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-foreground/70">
                Link sent — check your email at <span className="text-foreground/90">{email.trim()}</span>.
              </p>
              {/* Email can be mistyped, delayed, or lost. A confirmation that
                  locks the door behind it strands exactly the person whose
                  email did not arrive. */}
              <button
                type="button"
                onClick={() => setState("idle")}
                className="self-start whitespace-nowrap text-[12.5px] font-medium text-amber-300/90 transition-colors hover:text-amber-300"
              >
                Send it again, or use a different address
              </button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
            >
              <p className="text-[12.5px] text-foreground/55">
                No password — we email you a sign-in link.
              </p>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] outline-none ring-1 ring-white/15 placeholder:text-foreground/30 focus:ring-white/30"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="whitespace-nowrap rounded-lg bg-white px-3 py-2 text-[13px] font-medium text-black transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                {state === "sending" ? "Sending…" : "Email me a sign-in link"}
              </button>
              {state === "failed" && (
                <p className="text-[12px] text-red-300">Couldn't send to that address.</p>
              )}
            </form>
          )}
        </div>
      )}
    </span>
  )
}

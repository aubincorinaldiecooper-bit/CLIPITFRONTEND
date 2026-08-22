"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { forgetApiSession } from "@/lib/api"

/**
 * Who you are, in the header.
 *
 * Signed out it offers one thing: type your email, get a sign-in link. No
 * password exists anywhere to be typed, stored or forgotten. Signed in it
 * shows the address and a way out.
 *
 * Signing out ends both halves of the identity — the sign-in cookie on this
 * site and the API session derived from it — then reloads, so the page never
 * shows one person's videos with another person's name in the corner.
 */
export function AccountControl() {
  const { data: session, isPending } = authClient.useSession()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle")

  // While the signed-in state is still being read, saying nothing beats
  // flashing "Sign in" at someone who is.
  if (isPending) return null

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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] text-foreground/70 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-foreground"
      >
        Sign in
      </button>
    )
  }

  const send = async () => {
    const address = email.trim()
    if (!address || state === "sending") return
    setState("sending")
    const { error } = await authClient.signIn.magicLink({ email: address, callbackURL: "/start" })
    setState(error ? "failed" : "sent")
  }

  if (state === "sent") {
    return (
      <span className="whitespace-nowrap text-[13px] text-foreground/60">
        Link sent — check your email.
      </span>
    )
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <input
        type="email"
        required
        autoFocus
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="w-48 rounded-full bg-white/5 px-3 py-1.5 text-[13px] outline-none ring-1 ring-white/15 placeholder:text-foreground/30 focus:ring-white/30"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-black transition-transform active:scale-[0.97] disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Email me a link"}
      </button>
      {state === "failed" && (
        <span className="whitespace-nowrap text-[12px] text-red-300">Couldn't send to that address.</span>
      )}
    </form>
  )
}

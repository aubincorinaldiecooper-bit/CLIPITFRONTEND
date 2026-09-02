"use client"

import { useEffect, useState } from "react"
import { Button } from "@astryxdesign/core/Button"
import { Popover } from "@astryxdesign/core/Popover"
import { Text } from "@astryxdesign/core/Text"
import { TextInput } from "@astryxdesign/core/TextInput"
import { VStack } from "@astryxdesign/core/Stack"
import { authClient } from "@/lib/auth-client"
import { returnAddress } from "@/lib/sign-in-return"
import { forgetApiSession } from "@/lib/api"

/**
 * Who you are, in the header — now on Astryx's Popover, Button and TextInput,
 * which bring the dialog semantics, focus handling, and Escape/outside
 * dismissal we previously hand-rolled or lacked.
 *
 * Signed out it offers one thing: type your email, get a sign-in link. No
 * password exists anywhere to be typed, stored or forgotten. Signed in it
 * shows the address and a way out.
 *
 * The decisions that predate the move, all kept:
 * - On a deployment where sign-in is not configured, this renders nothing at
 *   all — a guest-only setup is a supported setup, not one with a broken
 *   button in the corner.
 * - Arriving with #signin (the landing page's Sign in button) opens the
 *   panel directly — a Sign in button that lands you somewhere you must find
 *   another Sign in button is a broken promise.
 * - The sent state never locks the door: email can be mistyped, delayed, or
 *   lost, and a confirmation without a way back strands exactly the person
 *   whose email did not arrive.
 */
/**
 * `configured` prop: a server component that already knows whether sign-in
 * exists (the landing page does) passes the verdict down, so the button is
 * in the very first paint. Without it, the control asks the API itself.
 */
/**
 * Where a sign-in link should land: back here, with the query string intact,
 * unless "here" is a page that means nothing signed in. Built from
 * window.location alone, so it can only ever be a path on this site.
 */
function returnTo(): string {
  if (typeof window === "undefined") return "/start"
  const { pathname, search } = window.location
  if (pathname === "/" || pathname.startsWith("/api/")) return "/start"
  return `${pathname}${search}`
}

export function AccountControl({ configured: configuredFromServer }: { configured?: boolean } = {}) {
  const { data: session, isPending } = authClient.useSession()
  const [fetchedConfigured, setFetchedConfigured] = useState<boolean | null>(null)
  const configured = configuredFromServer ?? fetchedConfigured
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle")

  useEffect(() => {
    if (window.location.hash === "#signin") setOpen(true)
  }, [])

  useEffect(() => {
    if (configuredFromServer !== undefined) return
    let cancelled = false
    void fetch("/api/auth-configured")
      .then((response) => response.json() as Promise<{ configured: boolean }>)
      .then((body) => {
        if (!cancelled) setFetchedConfigured(body.configured)
      })
      .catch(() => {
        if (!cancelled) setFetchedConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [configuredFromServer])

  // Nothing until we know sign-in exists here and whether someone is signed
  // in — flashing "Sign in" at a signed-in person is worse than a beat of
  // empty space.
  if (!configured || isPending) return null

  if (session?.user) {
    return (
      <span className="flex items-center gap-3">
        <span className="hidden max-w-[16rem] truncate sm:block">
          <Text type="supporting">{session.user.email}</Text>
        </span>
        <Button
          label="Sign out"
          variant="secondary"
          size="sm"
          onClick={() => {
            void authClient.signOut().finally(() => {
              forgetApiSession()
              window.location.assign("/start")
            })
          }}
        />
      </span>
    )
  }

  const send = async () => {
    const address = email.trim()
    if (!address || state === "sending") return
    setState("sending")
    // Come back to where they were, not to a fixed page. Someone following
    // an invitation signs in from /join?invite=... and must land back on
    // that exact URL — a sign-in that drops the invitation leaves them with
    // no way to accept it short of digging the email out again. Only
    // same-origin paths are ever used as the destination.
    const { error } = await authClient.signIn.magicLink({ email: address, callbackURL: await returnAddress(returnTo()) })
    setState(error ? "failed" : "sent")
  }

  return (
    <Popover
      isOpen={open}
      onOpenChange={setOpen}
      placement="below"
      alignment="end"
      width={300}
      label="Sign in to CLIPIT"
      content={
        state === "sent" ? (
          <VStack gap={2}>
            <Text as="p" type="body">
              Link sent — check your email at {email.trim()}.
            </Text>
            <Button
              label="Send it again, or use a different address"
              variant="ghost"
              size="sm"
              onClick={() => setState("idle")}
            />
          </VStack>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <VStack gap={2}>
              <Text as="p" type="supporting">
                No password — we email you a sign-in link.
              </Text>
              <TextInput
                type="email"
                label="Email"
                isLabelHidden
                value={email}
                onChange={(value) => setEmail(value)}
                placeholder="you@example.com"
                hasAutoFocus
                isRequired
                status={state === "failed" ? { type: "error", message: "Couldn't send to that address." } : undefined}
              />
              <Button
                type="submit"
                label={state === "sending" ? "Sending…" : "Email me a sign-in link"}
                variant="primary"
                isLoading={state === "sending"}
                width="100%"
              />
            </VStack>
          </form>
        )
      }
    >
      <Button label="Sign in" variant="secondary" size="sm" />
    </Popover>
  )
}

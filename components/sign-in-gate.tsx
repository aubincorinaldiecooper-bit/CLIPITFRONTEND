"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { Button } from "@astryxdesign/core/Button"
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { TextInput } from "@astryxdesign/core/TextInput"
import { authClient } from "@/lib/auth-client"
import { ModalArt } from "@/components/modal-art"

/**
 * "You need to be signed in for that" — asked at the moment it matters, and
 * then getting out of the way.
 *
 * Clipping is open to guests on purpose: someone can upload a video, find a
 * moment and cut it without an account. Publishing, inviting and connecting
 * an account are not — they outlive a browser tab, so they need a person.
 *
 * The awkward part is that signing in here means a link in an email, which
 * means LEAVING the page. A prompt that sends you away and drops what you
 * were doing is barely better than a refusal. So the intent is parked in the
 * URL before the link is sent; the magic link returns to that exact URL,
 * query string intact, and the page picks the intent back up.
 *
 * The URL is the right place for it precisely because it survives the round
 * trip — a closed tab, a link opened on a different device, a browser that
 * clears storage. It carries no secret: a verb and an id the person already
 * has on screen.
 */

/** The parked action, as it appears in the address bar. */
const INTENT_KEY = "then"

export type SignInIntent =
  | { action: "publish"; clipId: string }
  | { action: "connect"; platform: string }
  | { action: "invite"; workspaceId: string }
  | { action: "send"; clipId: string }

function encodeIntent(intent: SignInIntent): string {
  return "clipId" in intent
    ? `${intent.action}:${intent.clipId}`
    : "platform" in intent
      ? `${intent.action}:${intent.platform}`
      : `${intent.action}:${intent.workspaceId}`
}

/** The parked intent, or null. Unrecognised values are ignored, not guessed. */
export function readIntent(search: string): SignInIntent | null {
  const raw = new URLSearchParams(search).get(INTENT_KEY)
  if (!raw) return null
  const [action, value] = raw.split(":")
  if (!value) return null
  if (action === "publish" || action === "send") return { action, clipId: value }
  if (action === "connect") return { action, platform: value }
  if (action === "invite") return { action, workspaceId: value }
  return null
}

/** Take the intent out of the address bar once it has been acted on. */
export function clearIntent(): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (!url.searchParams.has(INTENT_KEY)) return
  url.searchParams.delete(INTENT_KEY)
  // replaceState, so Back still goes where it should — it just no longer
  // carries an instruction that has already been carried out.
  window.history.replaceState(window.history.state, "", url.toString())
}

type GateValue = {
  /**
   * Run `action` if signed in; otherwise ask, and let the page resume from the
   * parked intent when they come back. Returns true when it ran.
   */
  requireSignIn: (intent: SignInIntent, action: () => void) => boolean
  isSignedIn: boolean
}

const SignInGateContext = createContext<GateValue | null>(null)

export function useSignInGate(): GateValue {
  const value = useContext(SignInGateContext)
  if (!value) {
    // A gated button outside the provider would silently act as though
    // everyone is signed in. Failing loudly in development is the point.
    throw new Error("useSignInGate must be used inside <SignInGate>")
  }
  return value
}

export function SignInGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  const [asking, setAsking] = useState<SignInIntent | null>(null)
  const isSignedIn = Boolean(session?.user)

  const requireSignIn = useCallback(
    (intent: SignInIntent, action: () => void) => {
      // While the session is still loading, treat it as signed-in and let the
      // action run: the API is the real gate, and it answers honestly. Putting
      // a sign-in box in front of somebody who IS signed in, because a check
      // had not finished, is the worse failure.
      if (isSignedIn || isPending) {
        action()
        return true
      }
      setAsking(intent)
      return false
    },
    [isSignedIn, isPending],
  )

  return (
    <SignInGateContext.Provider value={{ requireSignIn, isSignedIn }}>
      {children}
      <SignInDialog intent={asking} onClose={() => setAsking(null)} />
    </SignInGateContext.Provider>
  )
}

/**
 * The prompt itself. Says what it is for — "Sign in to publish" reads as a
 * consequence of what you just pressed, where a bare "Sign in" reads as an
 * interruption.
 */
function SignInDialog({ intent, onClose }: { intent: SignInIntent | null; onClose: () => void }) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle")

  useEffect(() => {
    if (intent) setState("idle")
  }, [intent])

  const purpose =
    intent?.action === "publish"
      ? "to publish this clip"
      : intent?.action === "connect"
        ? "to connect an account"
        : intent?.action === "invite"
          ? "to invite someone"
          : "to send this clip to a workspace"

  const send = async () => {
    const address = email.trim()
    if (!address || !intent || state === "sending") return
    setState("sending")

    // Park the intent BEFORE sending, so the link's return address carries it.
    const url = new URL(window.location.href)
    url.searchParams.set(INTENT_KEY, encodeIntent(intent))
    window.history.replaceState(window.history.state, "", url.toString())

    const { error } = await authClient.signIn.magicLink({
      email: address,
      callbackURL: `${window.location.pathname}${window.location.search}`,
    })
    setState(error ? "failed" : "sent")
  }

  return (
    <Dialog
      isOpen={intent !== null}
      onOpenChange={(open) => !open && onClose()}
      purpose="form"
      width="min(420px, 94vw)"
    >
      <ModalArt kind="sign-in" onClose={onClose} />
      <DialogHeader
        title={`Sign in ${purpose}`} />
      {state === "sent" ? (
        <VStack gap={3} align="stretch">
          <Text as="p" type="body" display="block">
            Link sent — check your email at {email.trim()}. Open it and you&apos;ll land back here,
            ready to carry on.
          </Text>
          <HStack justify="end">
            <Button label="Use a different address" variant="secondary" size="sm" onClick={() => setState("idle")} />
          </HStack>
        </VStack>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <VStack gap={3} align="stretch">
            <Text as="p" type="supporting" display="block">
              We&apos;ll email you a link — no password. Clips you have already made come with you.
            </Text>
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              isRequired
            />
            {state === "failed" && (
              <Text as="p" type="supporting" display="block">
                That didn&apos;t send. Check the address and try again.
              </Text>
            )}
            <HStack gap={2} justify="end">
              <Button label="Cancel" variant="secondary" onClick={onClose} />
              <Button
                label="Email me a link"
                variant="primary"
                type="submit"
                isLoading={state === "sending"}
                isDisabled={email.trim() === ""}
              />
            </HStack>
          </VStack>
        </form>
      )}
    </Dialog>
  )
}

/**
 * Run `resume` once, when the page loads carrying an intent that matches.
 *
 * Guarded by a ref rather than the URL alone: clearing the parameter is a
 * history edit, and a re-render between the two would otherwise fire the
 * action twice — publishing a clip twice, in public.
 */
export function useResumeIntent(
  matches: (intent: SignInIntent) => boolean,
  resume: (intent: SignInIntent) => void,
): void {
  const { isSignedIn } = useSignInGate()
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !isSignedIn || typeof window === "undefined") return
    const intent = readIntent(window.location.search)
    if (!intent || !matches(intent)) return
    done.current = true
    clearIntent()
    resume(intent)
  }, [isSignedIn, matches, resume])
}

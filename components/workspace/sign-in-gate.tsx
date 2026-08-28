"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { clearIntent, readIntent, type SignInIntent } from "@/components/sign-in-gate"

/**
 * The sign-in gate, for the WORKSPACE screens only — the shadcn/uselayouts
 * pilot. Same behaviour as components/sign-in-gate.tsx, which the rest of the
 * app keeps: ask at the moment it matters, park the errand in the URL, resume
 * when the magic link brings the person back. What changes is the furniture —
 * a plain shadcn Dialog, per the owner's call, instead of the split-photo
 * modal.
 *
 * A separate provider rather than an edit to the shared one, so the other
 * screens' dialog does not change out from under them: the nearest provider
 * wins for this subtree, and only workspace pages mount this one.
 */

const INTENT_KEY = "then"

function encodeIntent(intent: SignInIntent): string {
  return "clipId" in intent
    ? `${intent.action}:${intent.clipId}`
    : "platform" in intent
      ? `${intent.action}:${intent.platform}`
      : `${intent.action}:${intent.workspaceId}`
}

type GateValue = {
  /** Run `action` if signed in; otherwise ask, and resume on return. */
  requireSignIn: (intent: SignInIntent, action: () => void) => boolean
  /** Open the dialog with no errand — "this page, signed in" is the errand. */
  askToSignIn: () => void
  isSignedIn: boolean
}

const WorkspaceGateContext = createContext<GateValue | null>(null)

export function useWorkspaceSignInGate(): GateValue {
  const value = useContext(WorkspaceGateContext)
  if (!value) {
    throw new Error("useWorkspaceSignInGate must be used inside <WorkspaceSignInGate>")
  }
  return value
}

export function WorkspaceSignInGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  const [asking, setAsking] = useState<SignInIntent | "plain" | null>(null)
  const isSignedIn = Boolean(session?.user)

  const requireSignIn = useCallback(
    (intent: SignInIntent, action: () => void) => {
      // While the session is still loading, let the action run: the API is
      // the real gate. A sign-in box in front of somebody who IS signed in
      // is the worse failure.
      if (isSignedIn || isPending) {
        action()
        return true
      }
      setAsking(intent)
      return false
    },
    [isSignedIn, isPending],
  )

  const askToSignIn = useCallback(() => setAsking("plain"), [])

  return (
    <WorkspaceGateContext.Provider value={{ requireSignIn, askToSignIn, isSignedIn }}>
      {children}
      <GateDialog intent={asking} onClose={() => setAsking(null)} />
    </WorkspaceGateContext.Provider>
  )
}

function GateDialog({
  intent,
  onClose,
}: {
  intent: SignInIntent | "plain" | null
  onClose: () => void
}) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle")

  useEffect(() => {
    if (intent) setState("idle")
  }, [intent])

  const purpose =
    intent === "plain"
      ? null
      : intent?.action === "publish"
        ? "to publish"
        : intent?.action === "connect"
          ? "to connect"
          : intent?.action === "invite"
            ? "to invite"
            : "to send"

  const send = async () => {
    const address = email.trim()
    if (!address || !intent || state === "sending") return
    setState("sending")

    // Park the errand BEFORE sending, so the link's return address carries
    // it. A plain sign-in has nothing to park — the link already returns to
    // this page, and arriving signed in is the whole resumption.
    if (intent !== "plain") {
      const url = new URL(window.location.href)
      url.searchParams.set(INTENT_KEY, encodeIntent(intent))
      window.history.replaceState(window.history.state, "", url.toString())
    }

    const { error } = await authClient.signIn.magicLink({
      email: address,
      callbackURL: `${window.location.pathname}${window.location.search}`,
    })
    setState(error ? "failed" : "sent")
  }

  return (
    <Dialog open={intent !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="shadcn-scope sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>
            {state === "sent" ? "Check your email." : "We'll send you a sign-in link."}
          </DialogDescription>
        </DialogHeader>
        {state === "sent" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Sent to {email.trim()}. Open it and you&apos;ll land back here, ready to carry on.
            </p>
            <div>
              <Button variant="secondary" size="sm" onClick={() => setState("idle")}>
                Use a different address
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
            className="flex flex-col gap-4"
          >
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email"
              required
            />
            {state === "failed" && (
              <p className="text-sm text-muted-foreground">
                That didn&apos;t send. Check the address and try again.
              </p>
            )}
            <div>
              <Button type="submit" disabled={email.trim() === "" || state === "sending"}>
                {state === "sending"
                  ? "Sending…"
                  : purpose
                    ? `Continue ${purpose}`
                    : "Email me a sign-in link"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Whether this deployment can sign anyone in. The empty states use it to
 * offer a Sign in button only where one can work — on a guest-only
 * deployment the button would open a form whose send can only fail, so the
 * page says sign-in isn't available instead. Null while unknown; the words
 * never wait on it, only the button does.
 */
export function useAuthConfigured(): boolean | null {
  const [configured, setConfigured] = useState<boolean | null>(null)
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
  return configured
}

/** Run `resume` once, when the page loads signed-in carrying a matching errand. */
export function useWorkspaceResumeIntent(
  matches: (intent: SignInIntent) => boolean,
  resume: (intent: SignInIntent) => void,
): void {
  const { isSignedIn } = useWorkspaceSignInGate()
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

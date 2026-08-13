import Link from "next/link"

/**
 * Destination for the landing page CTA. The ingest flow (upload / YouTube URL,
 * then the clip instruction) lands here; this is the placeholder so the call to
 * action is not a dead link.
 */
export default function StartPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-3xl">Start clipping</h1>
      <p className="max-w-sm text-sm text-foreground/60">
        The upload and YouTube ingest flow goes here.
      </p>
      <Link
        href="/"
        className="mt-2 text-sm text-foreground/70 underline underline-offset-4 hover:text-foreground"
      >
        Back
      </Link>
    </main>
  )
}

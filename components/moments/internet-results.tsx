"use client"

import type { InternetCandidate } from "@/lib/types"

/**
 * What the internet search found: pages worth watching, in the order the
 * provider ranked them.
 *
 * These are pages, not clips. Nothing has been watched yet — the browser
 * runtime and the model come next — so this says what was found and no more
 * than that. An empty answer is stated as an empty answer: the provider
 * looked and came back with nothing, which is a different thing from the
 * search having failed, and that case never reaches here.
 */
export function InternetResults({
  query,
  candidates,
}: {
  query: string
  candidates: InternetCandidate[]
}) {
  return (
    <section className="mt-8 w-full max-w-[640px]" aria-label="Internet search results" data-testid="internet-results">
      <p className="mb-3 text-sm text-muted-foreground">
        {candidates.length === 0
          ? `Nothing came back for “${query}”.`
          : `${candidates.length} ${candidates.length === 1 ? "page" : "pages"} found for “${query}”.`}
      </p>

      <ul className="flex flex-col gap-2">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <a
              href={candidate.pageUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
              data-testid="internet-candidate"
            >
              {candidate.thumbnailUrl ? (
                <img
                  src={candidate.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-24 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span aria-hidden className="aspect-video w-24 shrink-0 rounded-md bg-muted" />
              )}
              <span className="flex min-w-0 flex-col gap-1">
                <span className="line-clamp-2 text-sm font-medium text-foreground">{candidate.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {candidate.source ? `${candidate.source} · ` : ""}
                  {hostOf(candidate.pageUrl)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

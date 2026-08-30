import { redirect } from "next/navigation"

/**
 * Home IS uploading now — the owner's call (2026-08-30): "home will just be
 * 'upload your footage', with an empty state." The wordmark points at
 * /start; this route survives only so old links and bookmarks still land.
 */
export default function HomePage() {
  redirect("/start")
}

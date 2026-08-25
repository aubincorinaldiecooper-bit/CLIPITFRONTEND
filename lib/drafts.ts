/**
 * Captions kept between visits.
 *
 * A caption typed into the publish box already survives that box closing, but
 * only for as long as the tab lives. "Save draft" promises more than that —
 * somebody pressing it means "I am not finished, keep this" — so it is written
 * where a reload cannot take it.
 *
 * Local to the browser on purpose. A draft is a private half-thought, and
 * sending every keystroke of one to the server so it could sync between
 * devices is a bigger promise than the button makes, with a bigger cost.
 *
 * Every read and write is wrapped: storage throws outright in a private window
 * in some browsers, and when the quota is full. Losing a draft is bad; taking
 * the whole library page down because a draft could not be saved is worse.
 */

const KEY = "clipit.caption-drafts"

/** Every saved draft, keyed by clip id. `{}` when there are none or on error. */
export function savedDrafts(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    // Anything can be in storage — another tab, an older version of this app,
    // a person with the console open. Take only what is the right shape.
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {}
    const drafts: Record<string, string> = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "string") drafts[id] = value
    }
    return drafts
  } catch {
    return {}
  }
}

/**
 * Write one clip's draft down, or forget it when the text is empty.
 *
 * Emptying the box and saving is a deliberate "throw this away", so it removes
 * the entry rather than storing a blank one.
 */
export function saveDraft(clipId: string, text: string): void {
  if (typeof window === "undefined") return
  try {
    const all = savedDrafts()
    if (text.trim() === "") {
      delete all[clipId]
    } else {
      all[clipId] = text
    }
    window.localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Storage refused. The draft is still in memory for this tab, so the
    // person loses nothing right now.
  }
}

/** Drop a draft once the publish it was written for has gone out. */
export function clearDraft(clipId: string): void {
  saveDraft(clipId, "")
}

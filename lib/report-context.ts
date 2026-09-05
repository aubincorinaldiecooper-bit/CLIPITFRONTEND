/**
 * What the report dock says the person was looking at.
 *
 * The dock lives in the shell and knows only the page. A page that has a
 * video and a question on screen says so here, and clears it on the way
 * out, so a report made from it carries the ids a fix needs.
 */
export interface ReportContext {
  videoId: string | null
  clipRequestId: string | null
}

let current: ReportContext = { videoId: null, clipRequestId: null }

export function setReportContext(next: Partial<ReportContext>): void {
  current = { ...current, ...next }
}

export function readReportContext(): ReportContext {
  return current
}

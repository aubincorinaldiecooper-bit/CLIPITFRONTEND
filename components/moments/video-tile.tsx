"use client"

import { MatchBadge } from "@/components/moments/match-badge"
import { siteName } from "@/lib/video-embed"
import type { InternetMoment } from "@/lib/types"

/**
 * One found video, shown on its own.
 *
 * The frame is 9:16 and the picture is cropped to fill it — the owner's
 * decision, 2026-09-18, taken together with showing one result at a time.
 * The two go together: a single result gets the whole height of the column,
 * and a tall frame is the only shape that uses it.
 *
 * That crop is only safe because of what the picture is. `moment.still` is
 * the thumbnail the site itself publishes — cover art for the whole video,
 * chosen by whoever uploaded it. It is not a frame from the moment the
 * watcher matched, and has never been offered as one. So a 9:16 crop of a
 * 16:9 thumbnail loses some cover art and no evidence.
 *
 * It would not be safe the other way round. If this ever shows a frame the
 * watcher pulled from the matched interval, cropping it could throw away the
 * very thing that was matched, and a still that does not contain what we said
 * we found is the picture contradicting the result. Should that day come, fit
 * the frame whole and fill the rest rather than crop it.
 *
 * The height comes from the parent and the width follows from the ratio, so
 * the card grows and shrinks with the window without ever being letterboxed.
 *
 * The words live in `VideoCaption`, below the deck rather than inside the
 * slide, so the arrows can be anchored to the picture's own edges. The
 * picture's width is only knowable from its height, and a slide carrying a
 * caption of unknown height does not give you that.
 */

export interface VideoTileProps {
  moment: InternetMoment
}

function titleOf(moment: InternetMoment): string {
  return moment.title || moment.marks[0]?.description || "A video from this site"
}

function percentOf(moment: InternetMoment): number | null {
  if (moment.confidence === undefined) return null
  return Math.round(moment.confidence * 100)
}

/** What the watcher saw here, in its own words. The only line that says why this came back. */
function evidenceOf(moment: InternetMoment): string | null {
  const first = moment.marks[0]?.description?.trim()
  return first ? first : null
}

export function VideoTile({ moment }: VideoTileProps) {
  const still = moment.still
  const percent = percentOf(moment)

  return (
    <a
      href={moment.pageUrl}
      target="_blank"
      rel="noreferrer"
      className="group block h-full"
      data-testid="moment-slot-filled"
    >
      <div className="relative aspect-[9/16] h-full w-auto overflow-hidden rounded-[18px] bg-[#0d0f12] ring-1 ring-black/5 transition-shadow duration-200 group-hover:shadow-[0_10px_30px_rgba(16,20,26,0.18)]">
        {still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={still} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs leading-relaxed text-[#8d949d]">
            This site publishes no picture for the video.
          </span>
        )}

        {percent !== null && <MatchBadge value={percent} className="absolute top-3 left-3" />}
      </div>
    </a>
  )
}

/**
 * The words for whichever video is on screen.
 *
 * The evidence line is the watcher's own description of what it saw at the
 * first approved moment. It is the only line here that says why this video
 * came back at all — the rest is the video's name and where it lives.
 */
export function VideoCaption({ moment }: { moment: InternetMoment }) {
  const where = siteName(moment.pageUrl) ?? moment.source ?? ""
  const evidence = evidenceOf(moment)

  return (
    <div className="mx-auto w-full max-w-[34rem] text-center">
      <p className="line-clamp-2 text-[14px] leading-snug font-medium text-[#20242a]">{titleOf(moment)}</p>
      <p className="mt-1 truncate text-[12px] text-[#7a818b]">{where}</p>
      {evidence && (
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-[#5f6771]" data-testid="moment-evidence">
          {evidence}
        </p>
      )}
    </div>
  )
}

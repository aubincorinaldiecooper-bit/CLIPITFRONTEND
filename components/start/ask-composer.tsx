"use client"

import { useRef, useState } from "react"
import {
  ChatComposer,
  ChatComposerInput,
  type ChatComposerInputHandle,
  ChatSendButton,
} from "@astryxdesign/core/Chat"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon } from "@hugeicons/core-free-icons"
import { EFFORTS, EffortDial, MODEL_NAMES, ModelPicker } from "./composer-controls"
import { useVoiceCapture, VoiceLevels } from "./composer-voice"

/**
 * The owner's box, in one place.
 *
 * It was written inside the dialogue, where it is the thing you ask a
 * follow-up in. Home then had a bar of its own — an older pill with a video
 * glyph and a paper-plane — and the two looked nothing alike. The owner's
 * call of 2026-09-10 is that home wears THIS one: "the ONLY thing present on
 * our home screen is the same search input bar i shared".
 *
 * So it lives here now and both screens render it. What differs between them
 * is passed in: the words in the empty box, and what the plus attaches — a
 * video on home, a picture beside the moments.
 *
 * The model name and the effort dial are cosmetic, by the owner's
 * instruction, and neither reaches the caller. `NEXT_PUBLIC_COMPOSER_PREVIEW`
 * hides them from a creator's build until they do something — the same gate
 * they have always been behind, applied on both screens rather than one.
 */
export const COMPOSER_PREVIEW = process.env.NEXT_PUBLIC_COMPOSER_PREVIEW === "true"

export interface AskComposerProps {
  value: string
  onChange: (value: string) => void
  /** Called with the trimmed question. The box is controlled, so the caller decides whether the words leave it. */
  onSubmit: (value: string) => void
  placeholder: string
  /** Nothing here can be typed OR sent. */
  isDisabled?: boolean
  /**
   * Whether SENDING is allowed, separately from typing.
   *
   * Home needs the two apart and always has: while a video is still on its
   * way you can type — the line under the box promises exactly that — and
   * only the send waits for the bytes to land. `isDisabled` closes the whole
   * composer, so it cannot say this on its own, and without the split the
   * box would take a question and send it at a video that is not there yet.
   *
   * Leave it out to let the composer decide for itself, which is "is there
   * anything written".
   */
  canSend?: boolean
  /** The input's accessible name — what a screen reader calls the box. */
  label: string
  handleRef?: React.Ref<ChatComposerInputHandle>
  /**
   * What the plus picks up here. Absent means no plus.
   *
   * NOT behind the preview flag, and that distinction is the whole point of
   * the flag: it hides controls that do not work yet. Attaching a video on
   * home DOES work, and it is the only way a video gets in now that the drop
   * container is gone — gating it would ship a home screen a creator cannot
   * upload from. The caller decides whether its own attachment is real:
   * pictures beside the moments are still collected and dropped, so the
   * dialogue passes this only in a preview build.
   */
  attach?: {
    label: string
    /** An `accept` list for the file picker — videos on home, pictures beside the moments. */
    accept: string
    multiple?: boolean
    isDisabled?: boolean
    onPick: (files: File[]) => void
  }
  /** Anything the composer should open below itself, such as a tray of picked pictures. */
  drawer?: React.ReactNode
}

export function AskComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  isDisabled = false,
  canSend,
  label,
  handleRef,
  attach,
  drawer,
}: AskComposerProps) {
  // Both are strings on purpose: the pickers hand back a plain string, and
  // neither value goes anywhere but back into its own control.
  const [model, setModel] = useState<string>(MODEL_NAMES[0])
  const [effort, setEffort] = useState<string>(EFFORTS[0])
  const picker = useRef<HTMLInputElement>(null)
  const voice = useVoiceCapture()

  return (
    <>
      {/* Kept out of the composer's slots, next to the button that opens it. */}
      {attach && (
        <input
          ref={picker}
          type="file"
          accept={attach.accept}
          multiple={attach.multiple}
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            // So picking the same file twice still fires a change — a retry
            // after a failed upload is exactly that.
            event.target.value = ""
            if (files.length > 0) attach.onPick(files)
          }}
        />
      )}
      <ChatComposer
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder={placeholder}
        isDisabled={isDisabled}
        input={<ChatComposerInput label={label} maxRows={4} handleRef={handleRef} />}
        // Astryx's own send button, with one gate added. Passing `undefined`
        // hands the decision back to the composer, which asks whether
        // anything has been written.
        sendButton={<ChatSendButton isDisabled={canSend === false || undefined} />}
        drawer={COMPOSER_PREVIEW ? drawer : undefined}
        footerActions={
          COMPOSER_PREVIEW ? (
            <>
              <ModelPicker value={model} onChange={setModel} />
              <EffortDial value={effort} onChange={setEffort} />
            </>
          ) : undefined
        }
        // Left of the send button, where the draft put them. The row exists
        // for a working attachment even in a creator's build; only the
        // microphone waits on the flag.
        sendActions={
          COMPOSER_PREVIEW || attach ? (
            <>
              {COMPOSER_PREVIEW && <VoiceLevels levels={voice.levels} isRecording={voice.isRecording} />}
              {attach && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => picker.current?.click()}
                  disabled={attach.isDisabled}
                  className="flex size-7 items-center justify-center rounded-full text-foreground/50 outline-none transition-all duration-200 hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                  aria-label={attach.label}
                >
                  <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                </button>
              )}
            </>
          ) : undefined
        }
        // The draft turned its send button into a stop while recording; the
        // composer does that itself.
        isStopShown={COMPOSER_PREVIEW && voice.isRecording}
        onStop={voice.stop}
        // Where a refused microphone is said out loud, instead of the draft's
        // console warning nobody reads.
        status={COMPOSER_PREVIEW && voice.problem ? { type: "warning", message: voice.problem } : undefined}
      />
    </>
  )
}

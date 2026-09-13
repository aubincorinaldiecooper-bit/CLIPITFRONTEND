"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChatComposer,
  ChatComposerInput,
  type ChatComposerInputHandle,
  ChatSendButton,
} from "@astryxdesign/core/Chat";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import {
  EFFORTS,
  EffortDial,
  MODEL_NAMES,
  ModelPicker,
} from "./composer-controls";
import { useVoiceCapture, VoiceLevels } from "./composer-voice";

/**
 * The one composer Clipit uses both before a search and for follow-ups.
 *
 * It stays intentionally larger than a conventional chat input: the user's
 * question is the primary interface, while video is attached as context. The
 * model and effort controls remain preview-only until they actually affect the
 * backend request.
 *
 * Motion here is deliberately tactile rather than decorative. An attachment
 * eases into the composer, the composer lifts a fraction to acknowledge the
 * added context, and the two physical controls compress very slightly when
 * pressed. The app-level MotionConfig already respects prefers-reduced-motion.
 */
export const COMPOSER_PREVIEW =
  process.env.NEXT_PUBLIC_COMPOSER_PREVIEW === "true";

const QUICK_EASE = [0.22, 1, 0.36, 1] as const;

export interface AskComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Called with the trimmed question. The box is controlled, so the caller decides whether the words leave it. */
  onSubmit: (value: string) => void;
  placeholder: string;
  /** Nothing here can be typed OR sent. */
  isDisabled?: boolean;
  /**
   * Whether SENDING is allowed, separately from typing.
   *
   * Home needs the two apart: while a video is still on its way you can type,
   * and only sending waits for the bytes to land.
   */
  canSend?: boolean;
  /** The input's accessible name — what a screen reader calls the box. */
  label: string;
  handleRef?: React.Ref<ChatComposerInputHandle>;
  /** What the plus picks up here. Absent means no plus. */
  attach?: {
    label: string;
    /** An `accept` list for the file picker — videos on home, pictures beside the moments. */
    accept: string;
    multiple?: boolean;
    isDisabled?: boolean;
    onPick: (files: File[]) => void;
  };
  /** Anything the composer should open below itself, such as a tray of picked pictures. */
  drawer?: React.ReactNode;
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
  const [model, setModel] = useState<string>(MODEL_NAMES[0]);
  const [effort, setEffort] = useState<string>(EFFORTS[0]);
  const picker = useRef<HTMLInputElement>(null);
  const voice = useVoiceCapture();
  const submit = (nextValue: string) => {
    if (isDisabled || canSend === false) return;
    onSubmit(nextValue);
  };

  const animatedDrawer = (
    <AnimatePresence initial={false} mode="popLayout">
      {drawer ? (
        <motion.div
          key="composer-drawer"
          initial={{ opacity: 0, y: 8, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.995 }}
          transition={{ duration: 0.18, ease: QUICK_EASE }}
        >
          {drawer}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
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
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) attach.onPick(files);
          }}
        />
      )}
      <motion.section
        aria-label={`${label} composer`}
        className="relative w-full max-w-2xl"
        animate={{ y: drawer ? -2 : 0, scale: drawer ? 1.004 : 1 }}
        transition={{ duration: 0.2, ease: QUICK_EASE }}
      >
        <span className="block">
          <ChatComposer
            value={value}
            onChange={onChange}
            onSubmit={submit}
            placeholder={placeholder}
            isDisabled={false}
            input={
              <ChatComposerInput
                label={label}
                maxRows={5}
                handleRef={handleRef}
                isDisabled={isDisabled}
              />
            }
            sendButton={
              <motion.span className="inline-flex" whileTap={{ scale: 0.94 }} transition={{ duration: 0.12 }}>
                <ChatSendButton
                  isDisabled={isDisabled || canSend === false || undefined}
                />
              </motion.span>
            }
            drawer={animatedDrawer}
            footerActions={
              COMPOSER_PREVIEW ? (
                <>
                  <ModelPicker value={model} onChange={setModel} />
                  <EffortDial value={effort} onChange={setEffort} />
                </>
              ) : undefined
            }
            sendActions={
              COMPOSER_PREVIEW || attach ? (
                <>
                  {COMPOSER_PREVIEW && (
                    <VoiceLevels
                      levels={voice.levels}
                      isRecording={voice.isRecording}
                    />
                  )}
                  {attach && (
                    <motion.button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => picker.current?.click()}
                      disabled={attach.isDisabled}
                      whileTap={{ scale: 0.92 }}
                      transition={{ duration: 0.12 }}
                      className="flex size-8 items-center justify-center rounded-full text-foreground/50 outline-none transition-colors duration-150 hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                      aria-label={attach.label}
                    >
                      <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
                    </motion.button>
                  )}
                </>
              ) : undefined
            }
            isStopShown={COMPOSER_PREVIEW && voice.isRecording}
            onStop={voice.stop}
            status={
              COMPOSER_PREVIEW && voice.problem
                ? { type: "warning", message: voice.problem }
                : undefined
            }
          />
        </span>
      </motion.section>
    </>
  );
}

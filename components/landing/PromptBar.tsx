'use client';

/* Step 02: the brief. Types itself out when the step scrolls into view;
   the sparkle button replays it. */

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { Sparkles, Video } from 'lucide-react';

const PROMPT = 'vlog trip recaps with hooks at the start';

export default function PromptBar() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
  const [typed, setTyped] = useState('');
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setTyped(PROMPT); return; }
    setTyped('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(PROMPT.slice(0, i));
      if (i >= PROMPT.length) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [inView, reduce, run]);

  const done = typed.length === PROMPT.length;

  return (
    <div ref={ref} className="w-[min(96%,470px)]">
      <div className="flex w-full items-center gap-3 rounded-[26px] bg-[#fafaf9] px-4 py-3.5 shadow-[inset_0_0_0_2px_#121212]">
        <Video aria-hidden size={20} className="shrink-0 text-[#121212]" />
        <span aria-hidden className="h-6 w-px shrink-0 bg-[#dedbd5]" />
        <p className="min-w-0 flex-1 truncate text-left text-[.9rem] text-[#4a4741]">
          {typed || <span className="text-[#8a8781]">Tell Clipit what to look for&hellip;</span>}
          {!done && <span className="ml-px inline-block h-[1.05em] w-px translate-y-[.15em] bg-[#121212] motion-safe:animate-pulse" />}
        </p>
        <button
          onClick={() => setRun(r => r + 1)}
          aria-label="Rewrite the brief"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#efece7] text-[#121212] transition hover:bg-[#e4e0d9] active:scale-95"
        >
          <Sparkles size={17} />
        </button>
      </div>
    </div>
  );
}

'use client';

/* Step 03: Clipit part-way through the video. Fills to TARGET when the
   step scrolls into view and stays there — it is a loading state, so it
   never resolves. */

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { disp } from '@/lib/landing-tokens';

/** progress points at which each successive moment turns up */
const FOUND_AT = [10, 24, 39, 55, 71, 88];
/** where the bar settles — part-way through, still working */
const TARGET = 65;

export default function WatchProgress() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
  const [p, setP] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setP(TARGET); return; }
    const id = setInterval(() => {
      setP(v => {
        if (v >= TARGET) { clearInterval(id); return TARGET; }
        return v + 2;
      });
    }, 48);
    return () => clearInterval(id);
  }, [inView, reduce]);

  const found = FOUND_AT.filter(t => p >= t).length;

  return (
    <div ref={ref} className="w-[min(92%,440px)] rounded-[20px] bg-white p-6 shadow-[inset_0_0_0_2px_#121212]">
      <div className="flex items-center gap-3">
        <h4 style={disp(110, 800)} className="text-[clamp(1.15rem,2.1vw,1.5rem)] tracking-[-.02em]">
          Watching your content
        </h4>
        <span aria-hidden
          className="h-[22px] w-[22px] shrink-0 rounded-full border-[2.5px] border-[#e0ddd7] border-t-[#121212] motion-safe:animate-spin" />
      </div>

      <p role="status" className="mt-2 text-[.95rem] text-[#6b6965]">
        {found} moment{found === 1 ? '' : 's'} found so far
      </p>

      <div className="mt-4 h-[7px] w-full overflow-hidden rounded-full bg-[#e0ddd7]">
        <div
          className="h-full rounded-full bg-[#121212] transition-[width] duration-100 ease-linear"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

'use client';

/* Step 04: the approve/skip decision, in miniature. Posters only — the
   hero already carries the full video version, and two playing decks on
   one page would fight each other. */

import { useState } from 'react';
import { CLIPS } from '@/lib/landing-data';
import { disp } from '@/lib/landing-tokens';

/* offset, scale and dim by distance from the front card */
const FAN = [
  { x: 0,  s: 1,   b: 1,   o: 1 },
  { x: 40, s: .92, b: .55, o: 1 },
  { x: 68, s: .84, b: .38, o: .9 },
];

export default function ApproveDeck() {
  const [cur, setCur] = useState(0);
  const n = CLIPS.length;
  const next = () => setCur(c => (c + 1) % n);
  const front = CLIPS[cur];

  return (
    <div className="flex w-[min(96%,420px)] flex-col items-center">
      <h4 style={disp(110, 800)} className="text-[clamp(1.05rem,1.9vw,1.35rem)] tracking-[-.02em]">
        Keep this moment?
      </h4>

      <div className="relative mt-4 h-[176px] w-full">
        {CLIPS.map((c, i) => {
          let d = ((i - cur) % n + n) % n;
          if (d > n / 2) d -= n;
          const ad = Math.abs(d), sg = Math.sign(d);
          const hidden = ad > 2;
          const p = FAN[Math.min(ad, 2)];
          const front = ad === 0;
          return (
            <div
              key={c.id}
              aria-hidden={!front}
              /* No -translate-x-1/2 / -translate-y-1/2 here, deliberately.
                 Tailwind v4 emits those as the standalone `translate` CSS
                 property, which does not conflict with `transform` — it
                 COMPOSES with it. Together with the inline transform below,
                 every card was being centred twice: shifted a full width left
                 and a full height up instead of half of each. That lifted the
                 whole deck up over "Keep this moment?" and left the heading
                 sticking out to its right. The inline transform is the single
                 source of the card's position. */
              className="absolute left-1/2 top-1/2 h-[176px] w-[141px] overflow-hidden rounded-xl bg-[#141110] transition-all duration-500 ease-[cubic-bezier(.25,.8,.3,1)]"
              style={{
                transform: `translate(-50%, -50%) translateX(${sg * p.x}%) scale(${p.s})`,
                filter: `brightness(${p.b})`,
                opacity: hidden ? 0 : p.o,
                zIndex: 20 - ad,
                boxShadow: front ? '0 14px 32px rgba(20,12,6,.26)' : 'none',
              }}
            >
              <img src={c.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/95 to-transparent" />
              {front && (
                <span className="absolute inset-x-3 bottom-3 text-white">
                  <b className="block text-[.88rem] leading-tight tracking-tight" style={disp(106, 800)}>{c.title}</b>
                  <span className="mt-1 block text-[.72rem] leading-snug text-white/[.78]">{c.description}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-8">
        <span className="flex flex-col items-center gap-1.5">
          <button onClick={next} aria-label={`Skip ${front.title}`}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[1.1rem] text-[#8a8781] shadow-[inset_0_0_0_1.5px_#c9c6c0] transition hover:bg-[#8a8781] hover:text-white active:scale-95">
            &#10005;
          </button>
          <em className="text-[.76rem] not-italic text-[#6b6965]">Skip</em>
        </span>
        <span className="flex flex-col items-center gap-1.5">
          <button onClick={next} aria-label={`Keep ${front.title}`}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#121212] text-[1.1rem] text-white transition hover:scale-[1.07] active:scale-95">
            &#10003;
          </button>
          <em className="text-[.76rem] not-italic text-[#6b6965]">Keep</em>
        </span>
      </div>
    </div>
  );
}

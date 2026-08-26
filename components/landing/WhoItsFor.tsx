'use client';

import { useRef } from 'react';
import { AUDIENCES } from '@/lib/landing-data';
import { disp } from '@/lib/landing-tokens';
import Reveal from './Reveal';

export default function WhoItsFor() {
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  return (
    <section id="who" className="border-t border-[#e8e5e0] bg-white py-20">
      <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-10">
        <Reveal>
          <h2 style={disp(114, 800)} className="max-w-[20ch] text-[clamp(1.6rem,3.1vw,2.3rem)] leading-[1.08] tracking-[-.025em]">
            Made for anyone sitting on long footage.
          </h2>
          <p className="mt-2.5 max-w-[44ch] text-[#6b6965]">
            If you already shoot it, Clipit already has enough to work with.
          </p>
        </Reveal>

        <Reveal className="mt-9 grid gap-3 md:grid-cols-3 md:gap-[clamp(10px,1.6vw,18px)]">
          {AUDIENCES.map((a, i) => (
            <div key={a.title}
              onMouseEnter={() => vids.current[i]?.play().catch(() => {})}
              onMouseLeave={() => vids.current[i]?.pause()}
              className="group relative aspect-[16/10] overflow-hidden rounded-[18px] bg-[#141110] md:aspect-[4/5]">
              <img src={a.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <video ref={el => { vids.current[i] = el; }} src={a.videoSrc}
                     muted loop playsInline preload="none" aria-hidden
                     className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/90 to-transparent" />
              <span className="absolute inset-x-4 bottom-4 text-white">
                <b className="block text-[clamp(1rem,1.7vw,1.25rem)] tracking-tight" style={disp(108, 800)}>{a.title}</b>
                <span className="mt-1 block text-[.85rem] leading-snug text-white/80">{a.blurb}</span>
              </span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

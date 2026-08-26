'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import type { Clip } from '@/lib/landing-data';
import { disp } from '@/lib/landing-tokens';

interface Props {
  items: Clip[];
  /** fires whenever the front clip changes, so the source timeline can follow */
  onIndexChange?: (index: number) => void;
}

const VELOCITY_THRESHOLD = 500;

/* depth by distance from the front card: x offset (% of card), z, rotateY */
const RING = [
  { x: 0,  z: 0,    ry: 0,  b: 1,   o: 1 },
  { x: 50, z: -150, ry: 46, b: .72, o: 1 },
  { x: 80, z: -330, ry: 60, b: .5,  o: .85 },
];
const RING_NARROW = [
  { x: 0,  z: 0,    ry: 0,  b: 1,   o: 1 },
  { x: 36, z: -150, ry: 42, b: .7,  o: 1 },
  { x: 0,  z: -320, ry: 56, b: .5,  o: 0 },
];

export default function ClipStack({ items, onIndexChange }: Props) {
  const reduce = useReducedMotion();
  const [cur, setCur] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const [cardW, setCardW] = useState(248);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const n = items.length;

  const x = useMotionValue(0);
  const keepOpacity = useTransform(x, [0, 90], [0, 1]);
  const skipOpacity = useTransform(x, [-90, 0], [1, 0]);
  const dragRotate  = useTransform(x, [-200, 200], [-8, 8]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /* fan offsets animate in px so drag (px) and layout share units */
  useEffect(() => {
    const el = stageRef.current?.querySelector('button');
    if (!el) return;
    const measure = () => setCardW(el.getBoundingClientRect().width || 248);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rotate = useCallback((step: number) => {
    setCur(c => {
      const next = ((c + step) % n + n) % n;
      onIndexChange?.(next);
      return next;
    });
    x.set(0);
  }, [n, onIndexChange, x]);

  /* only the front clip decodes — six at once stalls phones */
  useEffect(() => {
    videos.current.forEach((v, k) => {
      if (!v) return;
      if (k === cur) v.play().catch(() => {});
      else v.pause();
    });
  }, [cur]);

  const ring = narrow ? RING_NARROW : RING;
  const spring = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 260, damping: 30,
        opacity: { duration: .4 }, filter: { duration: .4 } };

  return (
    <div className="flex w-full flex-col items-center">
      <div
        ref={stageRef}
        aria-label="Clips waiting for your approval"
        className="relative w-full max-w-[760px] [--cw:clamp(158px,48vw,220px)] sm:[--cw:clamp(190px,22vw,248px)]"
        style={{ height: 'calc(var(--cw) * 16 / 9 + 26px)', perspective: 1500 }}
        onKeyDown={e => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          rotate(e.key === 'ArrowRight' ? 1 : -1);
        }}
      >
        {items.map((item, i) => {
          let d = ((i - cur) % n + n) % n;
          if (d > n / 2) d -= n;
          const ad = Math.abs(d), sg = Math.sign(d);
          const hidden = ad > 2;
          const p = ring[Math.min(ad, 2)];
          const front = ad === 0;
          return (
            <motion.button
              key={item.id}
              aria-label={`Clip ${item.time} — ${item.title}. Drag right to approve, left to skip.`}
              tabIndex={front ? 0 : -1}
              className="absolute left-1/2 top-0 w-[var(--cw)] ml-[calc(var(--cw)/-2)] cursor-grab overflow-hidden rounded-[20px] bg-[#141110] text-left shadow-[0_26px_60px_rgba(20,12,6,.3)] aspect-[9/16] active:cursor-grabbing"
              style={{
                zIndex: 30 - ad,
                pointerEvents: front ? 'auto' : 'none',
                x: front ? x : undefined,
                rotate: front ? dragRotate : undefined,
                touchAction: 'pan-y',
              }}
              initial={false}
              animate={{
                translateX: sg * (p.x / 100) * cardW,
                z: p.z,
                rotateY: -sg * p.ry,
                opacity: hidden ? 0 : p.o,
                filter: `brightness(${p.b})`,
              }}
              transition={spring}
              drag={front ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.3}
              dragMomentum={false}
              onDragEnd={(_, info) => {
                const threshold = Math.max(70, cardW * 0.3);
                if (info.velocity.x > VELOCITY_THRESHOLD || info.offset.x > threshold) rotate(1);
                else if (info.velocity.x < -VELOCITY_THRESHOLD || info.offset.x < -threshold) rotate(-1);
                else x.set(0);
              }}
            >
              <video
                ref={el => { videos.current[i] = el; }}
                src={item.videoSrc} poster={item.poster}
                muted loop playsInline preload="none" aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />

              {front && (
                <>
                  <motion.span
                    style={{ opacity: keepOpacity, ...disp(108, 800) }}
                    className="absolute left-[18px] top-[18px] -rotate-[9deg] rounded-[10px] bg-[#121212] px-4 py-2 text-[1rem] tracking-[.06em] text-white">
                    KEEP
                  </motion.span>
                  <motion.span
                    style={{ opacity: skipOpacity, ...disp(108, 800) }}
                    className="absolute right-[18px] top-[18px] rotate-[9deg] rounded-[10px] bg-white px-4 py-2 text-[1rem] tracking-[.06em] text-[#8a8781] shadow-[inset_0_0_0_2px_#8a8781]">
                    SKIP
                  </motion.span>
                </>
              )}

              <motion.span className="absolute inset-x-[18px] bottom-4 text-white"
                initial={false}
                animate={{ opacity: front ? 1 : 0, y: front ? 0 : 6 }}
                transition={reduce ? { duration: 0 } : { duration: .35, delay: front ? .2 : 0 }}>
                <b className="block text-[clamp(1.05rem,1.9vw,1.35rem)] leading-tight tracking-tight" style={disp(108, 800)}>
                  {item.title}
                </b>
                <span className="mt-1 block text-[.84rem] leading-snug text-white/[.78]">{item.description}</span>
                <i className="mt-1.5 block text-[.74rem] font-semibold not-italic tabular-nums text-white/[.58]">{item.time}</i>
              </motion.span>
            </motion.button>
          );
        })}
      </div>

      {/* verdict controls */}
      <div className="mt-5 flex items-center justify-center gap-[clamp(22px,4vw,40px)]">
        <button onClick={() => rotate(-1)} aria-label="Skip this clip"
          className="flex h-[clamp(52px,6vw,62px)] w-[clamp(52px,6vw,62px)] items-center justify-center rounded-full bg-white text-[1.35rem] text-[#8a8781] shadow-[inset_0_0_0_2px_#8a8781] transition hover:bg-[#8a8781] hover:text-white active:scale-95">
          &#10005;
        </button>
        <button onClick={() => rotate(1)} aria-label="Approve this clip"
          className="flex h-[clamp(52px,6vw,62px)] w-[clamp(52px,6vw,62px)] items-center justify-center rounded-full bg-[#121212] text-[1.35rem] text-white transition hover:scale-[1.07] active:scale-95">
          &#10003;
        </button>
      </div>
    </div>
  );
}

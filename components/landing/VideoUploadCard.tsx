'use client';

/* Adapted from the VideoUploadCard component: the video falls in from
   above on a gravity curve, then springs on landing. Two nested elements
   — outer falls, inner bounces — because one can't do both. Here it is
   triggered by scrolling into view rather than a prop. */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { Pause, Play, Upload, X } from 'lucide-react';

interface Props { filename?: string; videoUrl?: string; poster?: string }

export default function VideoUploadCard({
  filename = 'night-shoot.mp4',
  videoUrl = '/landing/source.mp4',
  poster = '/landing/poster-source.jpg',
}: Props) {
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inView = useInView(cardRef, { once: true, margin: '0px 0px -20% 0px' });
  const [filled, setFilled] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => { if (inView) setFilled(true); }, [inView]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play().catch(() => {}) : v.pause();
  };

  return (
    <div ref={cardRef} className="w-[min(94%,420px)] rounded-[14px] bg-white p-3.5 shadow-[inset_0_0_0_1.5px_#e8e5e0]">
      <div
        onClick={() => { if (!filled) setFilled(true); }}
        className={'relative flex min-h-[238px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#cfccc6] p-4 transition-colors ' +
          (filled ? '' : 'cursor-pointer hover:bg-[#faf9f7]')}
      >
        <Upload aria-hidden size={44}
          className={'pointer-events-none absolute text-[#cfccc6] transition-opacity duration-300 ' + (filled ? 'opacity-0' : 'opacity-100')} />

        <AnimatePresence>
          {filled && (
            <motion.div
              key="vid"
              className="group relative w-full"
              initial={reduce ? false : { y: -330 }}
              animate={{ y: 0 }}
              exit={{ scale: 0, opacity: 0, filter: 'blur(8px)', transition: { duration: .4, ease: [.23, 1, .32, 1] } }}
              transition={reduce ? { duration: 0 } : { duration: 1.15, ease: [.55, .055, .675, .19] }}
            >
              <button
                onClick={e => { e.stopPropagation(); videoRef.current?.pause(); setFilled(false); }}
                aria-label="Remove this video"
                className="absolute -right-2 -top-2 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-[#121212] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <X size={11} />
              </button>

              <motion.div
                className="relative overflow-hidden rounded-[10px] bg-[#f7f5f2] shadow-[0_12px_28px_rgba(10,6,3,.2)]"
                initial={reduce ? false : { scale: .9 }}
                animate={{ scale: 1 }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 250, damping: 15, mass: 1.2, delay: .72 }}
              >
                <video ref={videoRef} src={videoUrl} poster={poster} muted playsInline preload="none" aria-hidden
                       onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
                       className="block aspect-video w-full object-cover" />
                <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}
                  className="absolute bottom-[38px] left-2 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75">
                  {playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
                </button>
                <div className="bg-white px-3 py-2.5 text-left text-[.78rem] font-medium text-[#6b6965]">{filename}</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

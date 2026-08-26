'use client';

import { motion, useReducedMotion } from 'motion/react';
import { CLIPS } from '@/lib/landing-data';
import { disp } from '@/lib/landing-tokens';
import ClipStack from './ClipStack';
import VideoPlayer from './VideoPlayer';
import { InstagramIcon, TikTokIcon, YouTubeIcon } from './BrandIcons';

const ease = [0.2, 0.7, 0.3, 1.05] as const;

const METRICS = [
  { pos: 'top-[6%] left-0',      icon: <TikTokIcon />,    n: '128k', unit: 'views' },
  { pos: 'top-[20%] right-0',    icon: <InstagramIcon />, n: '9.4k', unit: 'likes' },
  { pos: 'top-[47%] -left-[2%]', icon: <YouTubeIcon />,   n: '42k',  unit: 'views' },
  { pos: 'bottom-[22%] -right-[1%]', icon: null,          n: '312',  unit: 'comments' },
  { pos: 'bottom-[4%] left-[6%]',    icon: null,          n: '1.2k', unit: 'shares' },
];

export default function Hero() {
  const reduce = useReducedMotion();

  const seq = (i: number) => reduce ? {} : {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: .6, delay: .05 + i * .13, ease },
  };

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col items-center px-5 pb-14 pt-3 text-center sm:px-10">
      <motion.h1 {...seq(0)} style={disp(116, 800)}
        className="text-[clamp(2rem,5.1vw,4rem)] leading-[1.02] tracking-[-.025em]">
        <span className="text-[#7d7a75]">One video in.</span><br />A week of posts out.
      </motion.h1>

      <motion.p {...seq(1)} className="mt-4 max-w-[38ch] text-[clamp(1rem,1.55vw,1.16rem)] leading-[1.45] text-[#4a4741]">
        Clipit watches the whole thing, cuts the moments worth posting, and hands them to you ready to go.
      </motion.p>

      {/* the source video */}
      <motion.div {...seq(2)} className="mt-8 w-full max-w-[700px]">
        <VideoPlayer src="/landing/source.mp4" poster="/landing/poster-source.jpg" />
      </motion.div>

      {/* the deck, with metrics floating around it */}
      <motion.div {...seq(3)} className="relative flex w-full max-w-[880px] justify-center">
        <ClipStack items={CLIPS} />
        {METRICS.map(m => (
          <span key={m.unit + m.n}
            className={`absolute z-40 hidden items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-[.84rem] font-semibold shadow-[0_10px_26px_rgba(20,15,10,.13),inset_0_0_0_1.5px_#e8e5e0] lg:inline-flex ${m.pos}`}>
            {m.icon}{m.n} <em className="font-medium not-italic text-[#6b6965]">{m.unit}</em>
          </span>
        ))}
      </motion.div>
    </main>
  );
}

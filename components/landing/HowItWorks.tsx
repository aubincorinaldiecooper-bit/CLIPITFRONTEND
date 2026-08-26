'use client';

import { useRef } from 'react';
import type { ReactNode } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { disp } from '@/lib/landing-tokens';
import Reveal from './Reveal';
import VideoUploadCard from './VideoUploadCard';
import SchedulePicker from './SchedulePicker';
import ChannelPicker from './ChannelPicker';
import PromptBar from './PromptBar';
import WatchProgress from './WatchProgress';
import ApproveDeck from './ApproveDeck';

interface Step { num: string; title: string; body: string; visual: ReactNode }

const STEPS: Step[] = [
  {
    num: '01', title: 'Upload the long video',
    body: 'Drop in the whole shoot, unedited. That\u2019s your entire job in this step.',
    visual: <VideoUploadCard />,
  },
  {
    num: '02', title: 'Tell it what you\u2019re after',
    body: 'Where the clips are going, what to watch for, how they should feel. Clipit works to that brief instead of guessing.',
    visual: <PromptBar />,
  },
  {
    num: '03', title: 'Clipit watches all of it',
    body: 'Every minute gets reviewed \u2014 speech, scenes, action, reactions \u2014 and the moments worth posting get marked and cut.',
    visual: <WatchProgress />,
  },
  {
    num: '04', title: 'You approve the clips',
    body: 'Tick the ones you want, skip the rest. Nothing ever publishes without your say-so.',
    visual: <ApproveDeck />,
  },
  {
    num: '05', title: 'Pick where it goes',
    body: 'Connect your accounts once, then choose which ones each clip publishes to. Toggle any of them off and it skips that channel.',
    visual: <ChannelPicker />,
  },
  {
    num: '06', title: 'Publish everywhere',
    body: 'Approved clips go out on your schedule to every channel you\u2019ve left switched on.',
    visual: <SchedulePicker />,
  },
];

function StepRow({ step, first }: { step: Step; first: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  /* the rail fills as this step travels up through the viewport */
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'center 62%'] });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <Reveal className={'grid items-center gap-7 py-9 md:grid-cols-[1.05fr_.95fr] md:gap-14 ' +
      (first ? '' : 'border-t border-[#f1efeb]')}>
      {/* min-w-0 on both columns: grid items refuse to shrink below their
          content's minimum width by default, and on a phone that minimum
          (the widest step demo) pushed the whole page 16px past the viewport
          and gave the entire landing a horizontal scroll. */}
      <div ref={ref} className="flex min-w-0 aspect-[16/10] items-center justify-center">
        {step.visual}
      </div>
      <div className="relative min-w-0 pl-6 md:pl-8">
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] rounded bg-[#e8e5e0]" />
        <motion.span aria-hidden
          className="absolute left-0 top-0 h-full w-[2px] origin-top rounded bg-[#121212]"
          style={{ scaleY: reduce ? 1 : scaleY }} />
        <span className="text-[.85rem] font-semibold tracking-[.14em] text-[#121212]">{step.num}</span>
        <h3 style={disp(112, 800)} className="mb-3 mt-2 text-[clamp(1.5rem,2.9vw,2.3rem)] tracking-[-.025em]">{step.title}</h3>
        <p className="max-w-[36ch] text-[1.02rem] leading-relaxed text-[#6b6965]">{step.body}</p>
      </div>
    </Reveal>
  );
}

export default function HowItWorks() {
  return (
    <section id="how" className="border-t border-[#e8e5e0] bg-[#f7f5f2] py-20">
      <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-10">
        <Reveal className="mb-10">
          <span className="text-[.74rem] font-semibold uppercase tracking-[.16em] text-[#6b6965]">How it works</span>
          <h2 style={disp(114, 800)} className="mt-2.5 text-[clamp(1.8rem,3.6vw,2.8rem)] leading-[1.06] tracking-[-.025em]">
            Six steps, five of them ours.
          </h2>
        </Reveal>
        {STEPS.map((s, i) => <StepRow key={s.num} step={s} first={i === 0} />)}
      </div>
    </section>
  );
}

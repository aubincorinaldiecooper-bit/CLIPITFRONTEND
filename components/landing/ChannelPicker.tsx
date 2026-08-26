'use client';

/* Step 05: which connected accounts an approved clip goes out to. */

import { useState } from 'react';
import { InstagramIcon, TikTokIcon, YouTubeIcon } from './BrandIcons';

interface Channel { id: string; label: string; handle: string; icon: React.ReactNode }

const CHANNELS: Channel[] = [
  { id: 'tiktok',    label: 'TikTok',          handle: '@nightshoots', icon: <TikTokIcon /> },
  { id: 'reels',     label: 'Instagram Reels', handle: '@nightshoots', icon: <InstagramIcon /> },
  { id: 'shorts',    label: 'YouTube Shorts',  handle: '@nightshoots', icon: <YouTubeIcon /> },
];

export default function ChannelPicker() {
  const [on, setOn] = useState<Record<string, boolean>>({ tiktok: true, reels: true, shorts: false });
  const count = Object.values(on).filter(Boolean).length;

  return (
    <div className="w-[min(92%,380px)] rounded-[14px] bg-white p-3.5 shadow-[inset_0_0_0_1.5px_#e8e5e0]">
      <div className="flex flex-col gap-1.5">
        {CHANNELS.map(c => {
          const active = on[c.id];
          return (
            <button
              key={c.id}
              role="switch"
              aria-checked={active}
              aria-label={`${c.label}, ${c.handle}`}
              onClick={() => setOn(s => ({ ...s, [c.id]: !s[c.id] }))}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-[#faf9f7]"
            >
              <span className={active ? 'text-[#121212]' : 'text-[#b6b2ac]'}>{c.icon}</span>
              <span className="min-w-0 flex-1">
                <b className={'block text-[.88rem] font-semibold ' + (active ? 'text-[#121212]' : 'text-[#8a8781]')}>
                  {c.label}
                </b>
                <span className="block text-[.76rem] text-[#8a8781]">{c.handle}</span>
              </span>
              <span aria-hidden
                className={'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ' +
                  (active ? 'bg-[#121212]' : 'bg-white shadow-[inset_0_0_0_1.5px_#d8d5cf]')}>
                <span className={'absolute top-[3px] h-4 w-4 rounded-full transition-all ' +
                  (active ? 'left-[19px] bg-white' : 'left-[3px] bg-[#d8d5cf]')} />
              </span>
            </button>
          );
        })}
      </div>

      <p role="status" className="mt-2 border-t border-[#e8e5e0] px-3 pt-2.5 text-[.76rem] text-[#6b6965]">
        {count === 0
          ? <>No channels selected &mdash; nothing will publish.</>
          : <>Every approved clip goes to <b className="font-semibold text-[#121212]">{count} channel{count > 1 ? 's' : ''}</b>.</>}
      </p>
    </div>
  );
}

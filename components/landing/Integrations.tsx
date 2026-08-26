import { SIGNUP_URL } from '@/lib/landing-data';
import { disp } from '@/lib/landing-tokens';
import Reveal from './Reveal';
import { InstagramIcon, TikTokIcon, YouTubeIcon } from './BrandIcons';

const FLOATS = [
  { label: 'YouTube Shorts',  icon: <YouTubeIcon />,   pos: 'md:absolute md:left-[12%] md:top-[14%] md:-rotate-6' },
  { label: 'TikTok',          icon: <TikTokIcon />,    pos: 'md:absolute md:right-[10%] md:top-[22%] md:rotate-[5deg]' },
  { label: 'Instagram Reels', icon: <InstagramIcon />, pos: 'md:absolute md:bottom-[20%] md:left-[16%] md:rotate-[4deg]' },
  { label: 'Your schedule',   icon: null,              pos: 'md:absolute md:bottom-[14%] md:right-[14%] md:-rotate-[5deg]' },
];

export default function Integrations() {
  return (
    <section className="relative overflow-hidden border-t border-[#e8e5e0] bg-white py-24 text-center md:py-32">
      <div aria-hidden className="mb-7 flex flex-wrap justify-center gap-2.5 px-5 md:static md:mb-0">
        {FLOATS.map(f => (
          <span key={f.label}
            className={'inline-flex items-center gap-2 whitespace-nowrap rounded-[14px] bg-white px-5 py-3 text-[.9rem] font-semibold shadow-[0_10px_26px_rgba(20,15,10,.09),inset_0_0_0_1.5px_#e8e5e0] ' + f.pos}>
            {f.icon}{f.label}
          </span>
        ))}
      </div>
      <Reveal className="relative mx-auto max-w-[620px] px-6">
        <span className="inline-block rounded-full bg-white px-4 py-2 text-[.8rem] font-semibold shadow-[inset_0_0_0_1.5px_#e8e5e0]">Integrations</span>
        <h2 style={disp(114, 800)} className="mb-4 mt-4 text-[clamp(1.9rem,4.4vw,3.3rem)] leading-[1.04] tracking-[-.025em]">
          <span className="text-[#7d7a75]">Publish straight</span><br />from Clipit.
        </h2>
        <p className="mx-auto mb-6 max-w-[44ch] text-[clamp(1rem,1.5vw,1.15rem)] leading-relaxed text-[#4a4741]">
          Post directly to YouTube Shorts, TikTok and Instagram Reels. Connect your accounts once and every approved clip knows where to go.
        </p>
        <a href={SIGNUP_URL} className="inline-block rounded-full bg-[#121212] px-6 py-3 text-[.95rem] font-semibold text-white transition-transform hover:scale-[1.03]">
          Try Clipit free &rarr;
        </a>
      </Reveal>
    </section>
  );
}

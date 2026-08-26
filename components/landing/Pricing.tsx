'use client';

import { useState } from 'react';
import { SIGNUP_URL, TIERS } from '@/lib/landing-data';
import { disp } from '@/lib/landing-tokens';
import Reveal from './Reveal';

export default function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="border-t border-[#e8e5e0] bg-[#f7f5f2] py-20">
      <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-10">
        <Reveal className="mb-9 text-center">
          <span className="text-[.74rem] font-semibold uppercase tracking-[.16em] text-[#6b6965]">Pricing</span>
          <h2 style={disp(114, 800)} className="mt-2 text-[clamp(2rem,4.2vw,3.1rem)] tracking-[-.025em]">
            Start free. Grow when it works.
          </h2>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3.5 text-[.95rem] font-semibold">
            <span className={yearly ? 'font-medium text-[#6b6965]' : ''}>Billed monthly</span>
            <button role="switch" aria-checked={yearly} aria-label="Switch to yearly billing"
              onClick={() => setYearly(v => !v)}
              className="relative h-[30px] w-[52px] rounded-full bg-[#121212] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#121212]">
              <span className={'absolute left-1 top-1 h-[22px] w-[22px] rounded-full bg-white transition-transform duration-300 ' + (yearly ? 'translate-x-[22px]' : '')} />
            </button>
            <span className={yearly ? '' : 'font-medium text-[#6b6965]'}>Billed yearly</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[.78rem] font-semibold text-[#121212] shadow-[inset_0_0_0_1.5px_#e8e5e0]">2 months free yearly</span>
          </div>
        </Reveal>

        {/* Three columns, not four — a four-column grid with three tiers in it
            leaves a hole on the right. Two up at sm so the cards keep a
            readable width on a tablet. */}
        <Reveal className="mx-auto grid max-w-[980px] items-start gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {TIERS.map(t => {
            const price = yearly ? t.yr : t.mo;
            return (
              <div key={t.name}
                className={'relative flex h-full flex-col rounded-[20px] bg-white p-6 ' +
                  (t.hot ? 'shadow-[inset_0_0_0_2px_#121212,0_14px_34px_rgba(20,15,10,.09)]' : 'shadow-[inset_0_0_0_1.5px_#e8e5e0]')}>
                {t.hot && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#121212] px-3.5 py-1.5 text-[.72rem] font-bold uppercase tracking-[.08em] text-white">
                    Most popular
                  </span>
                )}
                <span aria-hidden className="text-[2rem] leading-none">{t.veh}</span>
                <h3 style={disp(110, 800)} className="mb-0.5 mt-3 text-[1.25rem]">{t.name}</h3>
                <span className="text-[.88rem] text-[#6b6965]">{t.who}</span>
                <div style={disp(110, 700)} className="mb-1 mt-4 text-[2.4rem] tracking-[-.03em]">
                  ${price}
                  <em className="text-[.9rem] font-medium not-italic tracking-normal text-[#6b6965]" style={{ fontFamily: 'var(--font-inter)' }}> / month</em>
                </div>
                <span className="min-h-[1.2em] text-[.78rem] text-[#6b6965]">
                  {yearly && t.mo > 0 ? `billed yearly ($${t.yr * 12})` : ''}
                </span>
                <a href={SIGNUP_URL}
                   className="my-4 block rounded-full bg-[#121212] py-3 text-center text-[.93rem] font-semibold text-white transition-transform hover:scale-[1.02]">
                  {t.mo === 0 ? 'Get started' : `Start ${t.name}`}
                </a>
                <ul className="mt-auto">
                  {t.feats.map(f => (
                    <li key={f} className="relative py-1.5 pl-6 text-[.9rem] text-[#3c3a36] before:absolute before:left-0 before:font-bold before:content-['\2713']">{f}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Reveal>

        <p className="mt-7 text-center text-[.82rem] text-[#6b6965]">
          Prices in USD. Cancel any time &mdash; your approved clips stay published.
        </p>
      </div>
    </section>
  );
}

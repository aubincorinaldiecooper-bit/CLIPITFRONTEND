import { FAQ } from '@/lib/landing-data';
import { disp } from '@/lib/landing-tokens';
import Reveal from './Reveal';

/* Native <details> — accessible, keyboard-friendly, no client JS. */
export default function Faq() {
  return (
    <section id="faq" className="border-t border-[#e8e5e0] bg-white py-20">
      <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 sm:px-10 md:grid-cols-[.8fr_1.2fr]">
        <Reveal>
          <span className="text-[.74rem] font-semibold uppercase tracking-[.16em] text-[#6b6965]">FAQ</span>
          <h2 style={disp(114, 800)} className="mt-2.5 text-[clamp(1.8rem,3.4vw,2.6rem)] leading-[1.06] tracking-[-.025em]">
            Common questions.
          </h2>
        </Reveal>
        <Reveal>
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-[#f1efeb] py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[1.02rem] font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="text-[1.3rem] font-medium text-[#6b6965] transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-[58ch] pb-5 leading-relaxed text-[#6b6965]">{a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

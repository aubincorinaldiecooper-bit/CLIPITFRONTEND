import { SIGNUP_URL } from '@/lib/landing-data';
import { disp } from '@/lib/landing-tokens';

const NAV = [['#who','Who it\u2019s for'], ['#how','How it works'], ['#pricing','Pricing'], ['#faq','FAQ']];

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-5 py-5 sm:px-10">
      <a href="#" style={disp(118, 800)} className="text-[1.35rem] tracking-tight text-[#121212]">clipit</a>
      <div className="flex items-center">
        <nav aria-label="Sections" className="mr-6 hidden gap-6 text-[.93rem] font-semibold sm:flex">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="text-[#121212] hover:text-[#6b6965]">{label}</a>
          ))}
        </nav>
        <a href={SIGNUP_URL}
           className="rounded-full bg-[#121212] px-6 py-3 text-[.95rem] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-[.98]">
          Try free
        </a>
      </div>
    </header>
  );
}

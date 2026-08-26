import { Logo } from '@/components/brand/logo';
import { SIGNUP_URL } from '@/lib/landing-data';

const NAV = [['#who','Who it\u2019s for'], ['#how','How it works'], ['#pricing','Pricing'], ['#faq','FAQ']];

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-5 py-5 sm:px-10">
      {/* The real lockup now — mark plus wordmark — rather than the word set
          in the display face. Same component as the footer and the app rail,
          so they cannot drift apart. */}
      <a href="#" aria-label="Clipit — home" className="text-[#121212]">
        <Logo size={26} />
      </a>
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

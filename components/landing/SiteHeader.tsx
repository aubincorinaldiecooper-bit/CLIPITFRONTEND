import { Logo } from '@/components/brand/logo';
import { SIGNUP_URL } from '@/lib/landing-data';

/**
 * The header is the mark and one action.
 *
 * It carried section links — Who it's for, How it works, FAQ, and Pricing while
 * that was shown. They are gone, along with the matching set in the footer.
 * On a page this short the links compete with the only thing the header is
 * there to offer, and a reader who wants a section finds it by scrolling
 * through it rather than by jumping past the rest.
 *
 * The section ids they pointed at (#who, #how, #faq) are left on the sections
 * themselves: they cost nothing and they still work in a shared link.
 */
export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-5 py-5 sm:px-10">
      {/* The real lockup now — mark plus wordmark — rather than the word set
          in the display face. Same component as the footer and the app rail,
          so they cannot drift apart. */}
      <a href="#" aria-label="Clipit — home" className="text-[#121212]">
        <Logo size={26} />
      </a>
      <a href={SIGNUP_URL}
         className="rounded-full bg-[#121212] px-6 py-3 text-[.95rem] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-[.98]">
        Try Clipit
      </a>
    </header>
  );
}

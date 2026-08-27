import { Logo } from '@/components/brand/logo';

/**
 * The footer is the mark and the copyright, and nothing else.
 *
 * It carried the same section links as the header — How it works, FAQ, and
 * Pricing while that was shown. Repeating the header's nav at the bottom of a
 * single-page site adds nothing: the reader has just scrolled past every one of
 * those sections to arrive here, and the links only send them back up.
 */
export default function SiteFooter() {
  return (
    <footer className="bg-[#f7f5f2] pb-10">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col items-center gap-3 border-t border-[#e8e5e0] px-5 pt-6 text-[.85rem] text-[#6b6965] sm:flex-row sm:justify-between sm:px-10">
        <a href="#" aria-label="Clipit — home" className="text-[#121212]">
          <Logo size={21} />
        </a>
        <span>&copy; 2026 Clipit</span>
      </div>
    </footer>
  );
}

import { disp } from '@/lib/landing-tokens';

export default function SiteFooter() {
  return (
    <footer className="bg-[#f7f5f2] pb-10">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col items-center gap-3 border-t border-[#e8e5e0] px-5 pt-6 text-[.85rem] text-[#6b6965] sm:flex-row sm:justify-between sm:px-10">
        <a href="#" style={disp(118, 800)} className="text-[1.15rem] text-[#121212]">clipit</a>
        <nav aria-label="Footer" className="hidden gap-6 font-medium sm:flex">
          <a href="#how" className="hover:text-[#121212]">How it works</a>
          <a href="#pricing" className="hover:text-[#121212]">Pricing</a>
          <a href="#faq" className="hover:text-[#121212]">FAQ</a>
        </nav>
        <span>&copy; 2026 Clipit</span>
      </div>
    </footer>
  );
}

/**
 * The front door — the owner's landing package, mounted as she shipped it.
 *
 * The only additions are this comment and the signed-in redirect below.
 * Everything else is her file: her sections, her metadata, her order.
 *
 * The HTML preview that used to be served here is gone. It was a single-file
 * export and it carried a CSS collision the components do not have: its
 * "Who it's for" section rule was unscoped and also matched each pricing
 * card's `.who` label, dropping a white 237px block over the tier emoji, the
 * tier name and part of the button. Pricing.tsx has no such problem — the
 * emoji, name and label are three separate elements with their own classes.
 */
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SiteHeader from '@/components/landing/SiteHeader';
import Hero from '@/components/landing/Hero';
import WhoItsFor from '@/components/landing/WhoItsFor';
import HowItWorks from '@/components/landing/HowItWorks';
import Integrations from '@/components/landing/Integrations';
import Pricing from '@/components/landing/Pricing';
import Faq from '@/components/landing/Faq';
import SiteFooter from '@/components/landing/SiteFooter';
import { SHOW_PRICING } from '@/lib/landing-data';

const DESC = 'Clipit watches your full video, cuts the moments worth posting, and hands them to you ready for Shorts, TikTok and Reels.';

export const metadata: Metadata = {
  title: 'Clipit — one video in, a week of posts out',
  description: DESC,
  // TODO: set metadataBase in the root layout, add /public/og.png (1200x630)
  // Resolved against metadataBase in the root layout, so these become
  // https://clipit.space/... — social apps ignore relative URLs and draw no
  // card at all. `url` and the canonical give the page one address rather
  // than letting a shared link with tracking parameters look like a
  // different page.
  alternates: { canonical: '/' },
  openGraph: { title: 'Clipit — one video in, a week of posts out', description: DESC, type: 'website',
               url: '/', siteName: 'Clipit',
               images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Clipit — one video in, a week of posts out' }] },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
};

/**
 * Belt and braces: `cookies()` below already opts this page into per-request
 * rendering, so this line is not what makes it dynamic — it just makes the
 * intent survive a refactor that removes the cookie check.
 */
export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  // Somebody already signed in has no business on the marketing page — carry
  // them to Home, as the previous landing did. Presence of the session cookie
  // is signal enough for a courtesy redirect; /home verifies it properly.
  const jar = await cookies();
  const signedIn = jar.getAll().some((c) => c.name.includes('session_token') && c.value !== '');
  if (signedIn) redirect('/home');

  return (
    <div
      // Lifts this page out of the app's Astryx theme. That theme colours
      // every heading with its dark-mode ink, which is invisible on a white
      // page — and the landing brings its own palette and type anyway. The
      // generated theme CSS is scoped `to ([data-astryx-theme])`, so any
      // value here ends the scope for this subtree.
      data-astryx-theme="landing"
      className="bg-white text-[#121212] antialiased"
      style={{ fontFamily: 'var(--font-inter)' }}
    >
      <SiteHeader />
      <Hero />
      <WhoItsFor />
      <HowItWorks />
      <Integrations />
      {SHOW_PRICING && <Pricing />}
      <Faq />
      <SiteFooter />
    </div>
  );
}

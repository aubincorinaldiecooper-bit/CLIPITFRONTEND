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

const DESC = 'Clipit watches your full video, cuts the moments worth posting, and hands them to you ready for Shorts, TikTok and Reels.';

export const metadata: Metadata = {
  title: 'Clipit — one video in, a week of posts out',
  description: DESC,
  // TODO: set metadataBase in the root layout, add /public/og.png (1200x630)
  openGraph: { title: 'Clipit — one video in, a week of posts out', description: DESC, type: 'website',
               images: [{ url: '/og.png', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
};

/**
 * Read the cookie on every request rather than at build time, so a returning
 * visitor is recognised. Without this the page would be static and everyone
 * would get the marketing copy.
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
      <Pricing />
      <Faq />
      <SiteFooter />
    </div>
  );
}

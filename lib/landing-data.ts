// Clipping is open to guests, so the product's real front door is /start
export const SIGNUP_URL = '/start';

/**
 * Whether the plans are shown at all.
 *
 * OFF while payment is being set up. Naming a price the product cannot yet
 * charge is worse than naming none: the first person to click Start Creator
 * finds nothing behind it.
 *
 * Turning this back on is this one line. Everything the plans touch reads it —
 * the section itself, the links to it in the header and the footer, and the FAQ
 * answer about monthly minutes, which means nothing with no plans on the page.
 * They are wired to the flag rather than deleted so none of them can be
 * forgotten on the way back.
 *
 * The section is removed from the page rather than hidden with CSS: hidden
 * prices are still in the HTML, still readable by anyone who looks, and still
 * indexable.
 *
 * Typed as boolean on purpose. Left as a literal, TypeScript narrows it to
 * `false` and every use becomes provably dead code — which trips lint rules and
 * strips the imports.
 */
export const SHOW_PRICING: boolean = false;

/**
 * Where an Enterprise enquiry goes: the founder's own inbox, directly.
 *
 * Chosen deliberately over a company address on a domain forwarder. The
 * forwarder was the earlier plan and would still work, but it is a DNS job that
 * has to be done and verified before the page can ship, and this address works
 * the moment it is deployed. "Chat with founder" is also a better offer than
 * "get in touch" for the tier it sits on — at enterprise size, reaching the
 * person who builds the thing IS the product.
 *
 * The trade, accepted knowingly: a mailto on a public page gets scraped, so
 * this inbox will attract spam, and replies come from a personal address rather
 * than from Clipit. Both are fixed by pointing this one constant at a
 * forwarding address later — nothing else in the page needs to change.
 *
 * The subject line is fixed so these are filterable on arrival.
 */
export const CONTACT_URL = 'mailto:aubincorinaldiecooper@gmail.com?subject=Clipit%20Enterprise';

export const RUNTIME = 47 * 60 + 32; // the demo source video, 47:32

export interface Clip {
  id: number;
  at: number;          // seconds into the source
  time: string;
  title: string;
  description: string;
  videoSrc: string;
  poster: string;
}

export const CLIPS: Clip[] = [
  { id: 1, at:  258, time: '04:18', title: 'Harbour skyline', description: 'Drone over the harbour at night.',        videoSrc: '/landing/clip1.mp4', poster: '/landing/poster1.jpg' },
  { id: 2, at:  527, time: '08:47', title: 'Waterfront run',  description: 'Highway lights along the waterfront.',    videoSrc: '/landing/clip2.mp4', poster: '/landing/poster2.jpg' },
  { id: 3, at:  845, time: '14:05', title: 'Straight down',   description: 'Looking straight down between the towers.', videoSrc: '/landing/clip3.mp4', poster: '/landing/poster3.jpg' },
  { id: 4, at: 1298, time: '21:38', title: 'Blue hour wide',  description: 'The whole city as the sky turns.',        videoSrc: '/landing/clip4.mp4', poster: '/landing/poster4.jpg' },
  { id: 5, at: 1764, time: '29:24', title: 'First donut',     description: 'First donut, crowd watching.',            videoSrc: '/landing/clip5.mp4', poster: '/landing/poster5.jpg' },
  { id: 6, at: 2476, time: '41:16', title: 'Tail lights',     description: 'Red glow through the tire smoke.',        videoSrc: '/landing/clip6.mp4', poster: '/landing/poster6.jpg' },
];

export interface Audience { title: string; blurb: string; videoSrc: string; poster: string }
export const AUDIENCES: Audience[] = [
  { title: 'Content creators', blurb: 'Vlogs, day-in-the-life, anything you already film.', videoSrc: '/landing/who1.mp4', poster: '/landing/who1.jpg' },
  { title: 'Brands',           blurb: 'One product shoot becomes a month of posts.',        videoSrc: '/landing/who2.mp4', poster: '/landing/who2.jpg' },
  { title: 'Podcasts',         blurb: 'Every episode holds a week of clips.',               videoSrc: '/landing/who3.mp4', poster: '/landing/who3.jpg' },
];

export interface Tier {
  name: string; who: string;
  /**
   * Dollars a month, and the per-month figure when billed yearly. Both are
   * null on a tier that is quoted rather than listed — the card then shows an
   * invitation to talk instead of a number, and the monthly/yearly switch has
   * nothing to reprice on it.
   */
  mo: number | null; yr: number | null;
  hot?: boolean;
  /** Overrides the card's button. Defaults to signing up. */
  cta?: { label: string; href: string };
  feats: string[];
}

/**
 * The plans.
 *
 * WHAT IS BEING SOLD IS MINUTES OF VIDEO GOING IN, not clips coming out. That
 * is how the cost is actually incurred — a video is split into chunks of
 * ANALYSIS_CHUNK_SECONDS and every chunk is read by a model, so a six-hour
 * upload costs roughly eighteen times what a twenty-minute one does. A plain
 * "videos a month" cap hides that: at the six-hour ceiling the upload screen
 * accepts, three videos could mean anything from forty-five minutes of
 * processing to eighteen hours of it, at the same price.
 *
 * It is also what every comparable product settled on. Opus Clip and Vizard
 * both meter one credit per minute of source video, and Klap counts videos but
 * pins a maximum length to each tier. All three have this cost structure and
 * all three arrived at the same answer.
 *
 * So each tier carries three numbers: a monthly allowance in minutes, a ceiling
 * on any single video, and — above Free — how many people can use it.
 *
 * Free publishes. It is watermarked and 720p rather than blocked, which is
 * again what the category does: a watermarked clip on someone's feed is the
 * product advertising itself, and blocking publishing only removes the
 * watermark from a clip they would download and post anyway. Creator's reason
 * to exist is then a clean export, not permission to post.
 *
 * Yearly is the two-months-free discount the page already advertises — ten
 * months' money for twelve.
 *
 * Every feature line describes something the product does today. Enterprise is
 * the exception in kind rather than in honesty: its lines are commitments about
 * service, which is what an enterprise tier sells.
 */
export const TIERS: Tier[] = [
  { name: 'Free',       who: 'Trying it out',       mo: 0,    yr: 0,
    feats: ['60 minutes of video a month','Up to 30 minutes per video','Publish to every channel you connect','Clips are watermarked, at 720p','No card needed'] },
  { name: 'Creator',    who: 'Posting on your own', mo: 17,   yr: 14,
    feats: ['Everything in Free, plus','300 minutes of video a month','Up to 2 hours per video','No watermark, full 1080p','Auto captions and scheduling'] },
  { name: 'Team',       who: 'Posting with a team', mo: 49,   yr: 41, hot: true,
    feats: ['Everything in Creator, plus','900 minutes of video a month','Up to 6 hours per video','5 seats and shared workspaces','Priority processing'] },
  { name: 'Enterprise', who: 'Posting at scale',    mo: null, yr: null,
    cta: { label: 'Chat with founder', href: CONTACT_URL },
    feats: ['Everything in Team, plus','Minutes and seats to fit your library','A dedicated contact, on call','Sessions to tune Clipit to your footage','Invoicing and security review'] },
];

export const FAQ: [string, string][] = [
  ['What is Clipit?',
   'Clipit watches your full-length video, finds the moments worth posting, and cuts them into vertical clips. You approve the ones you like and they publish to YouTube Shorts, TikTok and Instagram Reels.'],
  ['What footage works best?',
   'Anything long-form: talking-head videos, podcasts, vlogs, shoots, event coverage. The more distinct moments your video holds, the more clips come out of it.'],
  // Only makes sense alongside the plans — it answers a question about a
  // monthly allowance the page would not otherwise mention.
  ...(SHOW_PRICING
    ? ([['How are the minutes counted?',
         'By the length of the video you upload, not by how many clips come out of it. A 40-minute video costs 40 minutes of your monthly allowance whether Clipit finds three clips in it or thirty.']] as [string, string][])
    : []),
  ['Does Clipit ever post without me?',
   'No. Every clip waits in your review queue until you approve it. Nothing publishes on its own.'],
  ['Which platforms can I publish to?',
   'YouTube Shorts, TikTok and Instagram Reels directly. You can also download any clip and post it wherever you like.'],
  ['Who owns the clips?',
   'You do. Your footage stays yours, and everything you publish stays published even if you cancel.'],
];

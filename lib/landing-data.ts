// Clipping is open to guests, so the product's real front door is /start
export const SIGNUP_URL = '/start';

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
  veh: string; name: string; who: string;
  mo: number; yr: number;   // yr = per-month equivalent, billed yearly
  hot?: boolean; feats: string[];
}

// PLACEHOLDER PRICES — set real tiers before launch.
export const TIERS: Tier[] = [
  { veh: '🛹', name: 'Free',    who: 'Test the waters',  mo: 0,   yr: 0,
    feats: ['1 video a month','3 clips per video','Clipit watermark','You approve everything','No card needed'] },
  { veh: '🏍️', name: 'Creator', who: 'Posting weekly',   mo: 19,  yr: 15,
    feats: ['4 videos a month','Up to 8 clips per video','No watermark','Publish to Shorts, TikTok, Reels','Schedule queue'] },
  { veh: '🏎️', name: 'Growth',  who: 'Posting daily',    mo: 49,  yr: 39, hot: true,
    feats: ['20 videos a month','Unlimited clips','Auto captions and hook titles','Best-time scheduling','Performance stats'] },
  { veh: '🚀', name: 'Studio',  who: 'Teams and brands', mo: 149, yr: 119,
    feats: ['Unlimited videos','5 workspaces','Brand presets','Priority processing','API access'] },
];

export const FAQ: [string, string][] = [
  ['What is Clipit?',
   'Clipit watches your full-length video, finds the moments worth posting, and cuts them into vertical clips. You approve the ones you like and they publish to YouTube Shorts, TikTok and Instagram Reels.'],
  ['What footage works best?',
   'Anything long-form: talking-head videos, podcasts, vlogs, shoots, event coverage. The more distinct moments your video holds, the more clips come out of it.'],
  ['Does Clipit ever post without me?',
   'No. Every clip waits in your review queue until you approve it. Nothing publishes on its own.'],
  ['Which platforms can I publish to?',
   'YouTube Shorts, TikTok and Instagram Reels directly. You can also download any clip and post it wherever you like.'],
  ['Who owns the clips?',
   'You do. Your footage stays yours, and everything you publish stays published even if you cancel.'],
];

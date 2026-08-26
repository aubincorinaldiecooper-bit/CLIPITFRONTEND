/** Neutral palette. Arbitrary Tailwind values so your config stays untouched. */
export const C = {
  ink:   '#121212',
  white: '#ffffff',
  band:  '#f7f5f2',
  line:  '#e8e5e0',
  grey:  '#6b6965',
  body:  '#4a4741',
  lead:  '#7d7a75',
} as const;

import type { CSSProperties } from 'react';

/** Archivo pushed wide — the display voice. Body copy stays Inter. */
export const disp = (wdth = 116, wght = 800): CSSProperties => ({
  fontFamily: 'var(--font-archivo)',
  fontVariationSettings: `'wdth' ${wdth}, 'wght' ${wght}`,
});

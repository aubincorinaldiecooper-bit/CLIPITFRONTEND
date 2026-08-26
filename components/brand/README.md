# Brand

The monogram is vectorised from the owner's supplied artwork, not redrawn by
eye. `mark.ts` holds the path; everything else is generated from it, so the
favicon, the app icon, the share image and the on-screen logo can never
disagree with each other.

## Regenerating the rasters

All of `app/favicon.ico`, `app/apple-icon.png`, `public/icon-192.png`,
`public/icon-512.png` and `public/og.png` are rendered from `app/icon.svg`
and the same path. If the mark changes, re-render them rather than editing
any of them by hand.

## Type

The wordmark is Inter ExtraBold (800) at -0.025em, cased `Clipit`, per the
owner's spec of -2% to -3% tracking. Inter is loaded by the root layout.

## The domain

`https://clipit.space` is the default in `app/layout.tsx`, so a share card
works without anything being configured. `NEXT_PUBLIC_SITE_URL` still
overrides it, which is what lets a staging or preview deployment point at
itself instead of claiming to be production.

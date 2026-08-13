# CLIPIT — frontend

Landing page for CLIPIT: drop in a long video, describe the moment you want in
plain language, get the clip back. The backend lives in
[`aubincorinaldiecooper-bit/CLIPIT`](https://github.com/aubincorinaldiecooper-bit/CLIPIT).

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Motion · three.js

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## The landing page

A full-bleed orbit gallery — three rings of image tiles turning around a shared
vertical axis — with the wordmark, tagline and primary call to action centred
on top of it.

Two deliberate choices, both differing from the reference demo:

- **The viewer cannot drive the rotation.** `wheel={false}`, so no wheel
  listener is attached at all. The rings turn on their own and nothing the
  viewer does speeds them up, slows them down, or reverses them.
- **The call to action sits in the middle.** The reference centres a title and
  a "scroll or select" hint; here the centre is the wordmark, one line of
  copy, and the **Start clipping** button, over a radial scrim that keeps the
  text readable as lit tiles pass behind it.

Selecting a tile still settles it — it lifts, the rest dim, and the rings slow
— over `focusDuration`. `prefers-reduced-motion: reduce` stops the rotation.

## About the orbit gallery component

The brief called for Atelier's Orbit Gallery from the shadcn registry:

```bash
npx shadcn@latest init -d
npx shadcn@latest add @atelier/orbit-gallery
```

**Neither command can run in the environment this was built in.**
`ui.shadcn.com` is denied by the organisation's egress policy — the proxy
answers `403` to `CONNECT ui.shadcn.com:443` — so the registry is unreachable
and the `atelier-ui` skill was never fetched.

`components/orbit-gallery.tsx` is therefore a self-contained three.js
implementation that takes **the same props as Atelier's component**:

```tsx
<OrbitGallery
  items={ITEMS}
  radius={2.8}
  rings={3}
  ringGap={1.6}
  tileHeight={0.7}
  cornerRadius={0.08}
  spinSpeed={1}
  spinStagger={0.2}
  wheel={false}
  wheelMultiplier={3}
  revealDuration={2}
  focusDuration={1}
  onReady={() => setWebGlReady(true)}
/>
```

To adopt the registry component once `ui.shadcn.com` is reachable: run the two
commands above (`components.json` is already in place, so `init` can be
skipped), follow the `atelier-ui` skill it writes under `.agents/skills` and
`.claude/skills`, then change the import in `app/page.tsx`. The props and the
`onReady` handshake carry over unchanged; delete
`components/orbit-gallery.tsx` afterwards.

## Demo imagery

`public/images/demo/shared/1..20.webp` are generated placeholder gradients
(~2 KB each, 84 KB total), not photography. Replace them with real frames —
the paths are the only thing the page depends on.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/start` | Placeholder for the ingest flow, so the CTA is not a dead link |

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

`public/images/demo/shared/1..20.webp` currently hold generated placeholder
gradients (~2 KB each, 84 KB total), not photography.

To replace them with real imagery from [Pexels](https://www.pexels.com/api/)
(free key, commercial use, no attribution required):

```bash
PEXELS_API_KEY=xxxx npm run tiles:fetch
```

By default it pulls a still out of an actual video clip for each tile — which
is what the gallery is meant to depict — crops to 16:9 at 640×360, applies a
shared colour grade so twenty unrelated sources read as one set, and writes
`credits.json` recording the provenance of every tile.

```bash
npm run tiles:fetch -- --photos                    # photo library instead of video frames
npm run tiles:fetch -- --count 24 --width 960      # more, larger tiles
npm run tiles:fetch -- --queries "surfing,rally racing,live band"
npm run tiles:fetch -- --no-grade                  # keep the sources ungraded
```

Requires `ffmpeg` on PATH. The key is read from the environment and must never
be committed. Check the total weight before committing the result — twenty
photographic tiles land near 1 MB, against 84 KB for the placeholders:

```bash
du -sh public/images/demo/shared
```

Tiles render around 200 px wide, tilted and in motion, so favour high
contrast and a single clear subject; busy frames turn to mush at that size.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/start` | The clipping flow |

## The clipping flow

`/start` is the whole product on one page. Each stage is revealed as the
previous one completes and collapses to a summary line, so the path from
source to finished clip stays visible:

1. **Add a video** — drag/drop or pick a file, or paste a YouTube URL. Uploads
   go straight to storage with a presigned PUT, so the bytes never pass
   through the API; progress comes from the XHR upload events.
2. **Processing** — ffprobe metadata and chunk count, with the transcript
   reported separately, because a video becomes searchable before its
   transcript finishes.
3. **What do you want to find?** — free text, sent to the model verbatim. The
   example chips fill the box; they are not categories.
4. **Moments** — matches stream in while the search is still running, each with
   its timecode, duration, confidence and whether it was found on screen, in
   speech, or both. Select the ones you want, generate, and the clips appear
   inline as playable MP4s with download links.

### Configuration

```
NEXT_PUBLIC_API_URL=https://<your-backend>.up.railway.app
```

Without it, `/start` renders a notice instead of failing at the first request.

Auth is handled for you: the client mints an anonymous session token on first
use, keeps it in `localStorage`, and re-mints it if the backend rejects it.

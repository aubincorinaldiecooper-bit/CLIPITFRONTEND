<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# How to explain things here

Every summary, explanation, and status update is written for someone who is
not reading the code. This is a standing rule, not a per-message request.

- **Say what it means for the person using the app first.** "The bar sat at
  59% and never moved, so it looked stuck" comes before anything about which
  component computed it.
- **Short sentences. Ordinary words.** A term that only makes sense to someone
  who has read this repository — optimistic update, serializer, hydration,
  coverage — gets replaced, or explained once in the same breath.
- **Name the problem in the world, not in the file.**
- **No status-report voice.** Do not list what was touched. Say what changed
  and what it fixes.

Commit messages and pull request descriptions are the place for precision.
Chat is the place for being understood.

# Controls have to look finished

Every control ships laid out properly, and nothing moves when you use it.

- **Give a button its own room.** A label that wraps onto three lines because
  four things share one row is not a button, it is a mistake with a border.
  `whitespace-nowrap` on anything with a label, and if the row cannot hold
  everything, split the row.
- **Nothing reflows when actioned.** A card must not resize, jump or reorder
  because something inside it was clicked. Reserve the space the busy state,
  the longer label, or the confirmation will need.
- **Transient news is transient.** A confirmation, an undo, an "it worked"
  belongs in something that appears and leaves on its own. Permanent strips in
  a card are for permanent facts.
- **Check it at the width it will actually be seen at.** This drawer is a
  fixed 380px column. Anything designed at full width and squeezed into it
  will look squeezed into it.

## The design floors

Settled decisions — hold every screen to these:

- **Two type voices, one job each.** Instrument Serif is the wordmark's
  voice and nothing else's. Every other word in the interface is Geist.
- **A contrast floor for grey text.** On the dark ground, body-size text
  never drops below 60% foreground opacity; display-size text may go to
  50%. Anything fainter is decoration and must not carry words.
- **Reduced motion is honoured everywhere.** MotionConfig in
  components/providers.tsx covers motion/react; the guard in globals.css
  covers CSS animations. Spinners keep turning — they are information,
  not decoration.
- **Astryx components first.** Interface furniture (buttons, forms, nav,
  dialogs, tables) comes from @astryxdesign/core wearing theme/clipit.ts;
  hand-rolled equivalents need a reason. The theater media player stays
  custom by the owner's decision (2026-08-22).

<!-- ASTRYX:START -->
Astryx v0.4.5 · 158 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing, page frame included.
- Frame first: read `astryx docs layout` before writing any page or screen — page frame, region widths, breakpoint behavior.
- Dense data = rows (Table, List/Item), never Card-wrapped list items; Card is for standalone widgets. Status = StatusDot/Token; Badge = counts only.
- Custom styling: component props first; else Tailwind utilities backed by tokens (bg-surface, text-primary, rounded-lg) via tailwind-theme.css. No raw hex/px.
- Tokens for every value (`astryx docs tokens`). Brand/accent belongs in the theme (`astryx theme list` / `theme add <slug>`, or `astryx theme template` for a custom one) — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any style={{…}}, raw <div>/<span> layout, imported .css/@apply, or hardcoded/arbitrary value (e.g. bg-[#fff], p-[13px]) with the component or a token-backed utility. If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   158 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->

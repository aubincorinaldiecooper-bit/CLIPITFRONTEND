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

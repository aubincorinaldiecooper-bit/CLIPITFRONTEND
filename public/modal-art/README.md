# Modal artwork

Every modal opens with a band of picture. The owner's visual anchor is
high-contrast black-and-white photography — hard light, deep shadow, strong
architecture, a figure small in the frame.

## Adding one

1. Drop the file here, e.g. `sign-in.jpg`.
2. Name it in `PHOTOGRAPHS` in `components/modal-art.tsx`:

   ```ts
   const PHOTOGRAPHS: Partial<Record<ModalArtKind, string>> = {
     "sign-in": "/modal-art/sign-in.jpg",
   }
   ```

Nothing else changes. A kind with no entry falls back to the drawn artwork,
so pictures can arrive one modal at a time.

## What the code does to it

- **Greyscale is forced.** A colour image would otherwise drag the palette
  sideways. The anchor is monochrome and the treatment keeps every later
  picture in the same register.
- **Contrast is lifted slightly.** The anchor's character is its contrast.
- **The bottom fades into the panel**, so the picture resolves into the modal
  instead of stopping at a hard line above the title.

## What to supply

- **Wide.** The band is roughly 3:1 — around 1200×420 or larger. Portrait
  images get cropped hard through the middle.
- **The subject away from the top-right.** The close button sits there.
- **The subject away from the bottom.** The lower quarter fades into the panel.
- **Dark enough to carry white text nearby**, or at least not bright across
  the whole frame.

## Licensing

Only put a picture here that this project has the right to publish — shot by
the team, or licensed for commercial use with the licence recorded. A found
image is not usable however well it fits, and this directory is served
publicly to every visitor.

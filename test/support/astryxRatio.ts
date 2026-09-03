/**
 * The ratio Astryx put on a box.
 *
 * Read through one helper because where it lives is Astryx's business, and it
 * has already moved once. Through 0.4 the ratio was a hard inline
 * `aspect-ratio`. From 0.5 it is an inline custom property that a class turns
 * into the real declaration, so a consumer can override it responsively —
 * which is the point of the change, and why the old inline value is now empty.
 *
 * jsdom applies no stylesheet, so the computed value is `auto` either way and
 * the property is the only thing there is to read. Six test files were reading
 * the old location directly and all thirteen of their ratio assertions broke
 * on the upgrade at once; this is so the next move is one edit.
 */
export function astryxRatio(el: HTMLElement): number {
  const raw = el.style.getPropertyValue("--x-aspectRatio").trim() || el.style.aspectRatio
  if (!raw) return Number.NaN
  const parts = raw.split("/").map((part) => Number(part.trim()))
  const [width, height] = parts
  if (width === undefined || Number.isNaN(width)) return Number.NaN
  // A bare number is already the ratio; "9 / 16" has to be divided.
  return height === undefined || Number.isNaN(height) ? width : width / (height || 1)
}

import { VStack } from "@astryxdesign/core/Stack"

/**
 * The photograph beside a modal, filling the panel's left half edge to edge.
 *
 * This replaces the band that used to sit across the top. The band was the
 * earlier answer to the same question and it worked, but the owner's mockups
 * put the picture down the side instead, and the side is the better shape: a
 * 150px strip could only ever hold a sliver of a scene, and every modal is a
 * different width, so the same picture was sliced differently in each one — a
 * head cut off here, a spire cut off there. A half-panel is portrait, which is
 * the shape photographs of people actually come in.
 *
 * The picture is decorative. Every modal states its purpose in words on the
 * other half, so a reader who never sees this loses nothing, and it carries
 * aria-hidden and an empty alt to keep it out of the accessibility tree.
 */

export type ModalPhotoKind = "sign-in" | "workspace"

/**
 * The photograph for each modal, from public/modal-art/.
 *
 * An absent entry renders the panel as flat surface rather than a broken
 * image, so a modal is never wrecked by a missing file and pictures can be
 * added one at a time.
 */
const PHOTOGRAPHS: Partial<Record<ModalPhotoKind, string>> = {
  "sign-in": "/modal-art/sign-in.jpg",
  workspace: "/modal-art/workspace.jpg",
}

/**
 * How wide the picture is, against the form beside it.
 *
 * The mockups sit near 55/45 in the picture's favour. Below `MIN_WIDTH` the
 * dialog has no room for two columns and the picture is dropped entirely
 * rather than squeezed into a letterbox — on a phone the form is the whole
 * point and decoration that costs half the width is not decoration, it is an
 * obstacle.
 */
const PHOTO_SHARE = "54%"

export function ModalPhoto({ kind }: { kind: ModalPhotoKind }) {
  const photograph = PHOTOGRAPHS[kind]

  return (
    <VStack
      width={PHOTO_SHARE}
      // `hidden` up to the `sm` breakpoint is the narrow-viewport drop
      // described above; from `sm` up it is a flex column again.
      className="hidden shrink-0 self-stretch overflow-hidden bg-surface sm:flex"
      aria-hidden
    >
      {photograph && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photograph}
          alt=""
          aria-hidden
          className="h-full w-full object-cover"
        />
      )}
    </VStack>
  )
}

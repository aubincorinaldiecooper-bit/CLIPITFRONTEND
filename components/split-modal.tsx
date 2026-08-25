"use client"

import type { ReactNode } from "react"
import { Dialog } from "@astryxdesign/core/Dialog"
import { Divider } from "@astryxdesign/core/Divider"
import { Heading } from "@astryxdesign/core/Heading"
import { Icon } from "@astryxdesign/core/Icon"
import { IconButton } from "@astryxdesign/core/IconButton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { ModalPhoto, type ModalPhotoKind } from "@/components/modal-photo"

/**
 * A modal with a photograph down one side and the form down the other.
 *
 * Both modals that use it — signing in, and making a workspace — ask a person
 * for something before they can carry on, which is the moment a screen most
 * needs to feel like it was made by someone. The picture does that work; the
 * right-hand column does the asking.
 *
 * Shared rather than written twice so the proportions, the close button and
 * the footer rule stay identical between them. Two hand-built copies drift
 * within a week.
 *
 * The close button sits in its own row above the title rather than beside it.
 * `DialogHeader` will render a close of its own when handed `onOpenChange`,
 * and taking that route put a second X inside the panel — the modals carried
 * two for a while and it read as a mistake, because it was one.
 */
export function SplitModal({
  isOpen,
  onOpenChange,
  photo,
  title,
  subtitle,
  children,
  footer,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  photo: ModalPhotoKind
  title: string
  subtitle?: string
  /** The form itself. */
  children: ReactNode
  /**
   * Actions along the bottom, under a rule. Omitted when the form's own
   * button is the only action — a footer with one button in it is a bar for
   * the sake of a bar.
   */
  footer?: ReactNode
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      purpose="form"
      padding={0}
      width="min(880px, 94vw)"
      // The picture runs to the panel's edge, so without this it squares off
      // the two left corners the dialog has rounded.
      className="overflow-hidden"
      // Normally the dialog takes its name from a DialogHeader title. The
      // title here is a Heading instead — the mockups set it much larger than
      // DialogHeader draws it — so the name is given directly.
      aria-label={title}
    >
      <HStack gap={0} align="stretch">
        <ModalPhoto kind={photo} />

        <VStack className="min-w-0 flex-1" align="stretch" gap={0} minHeight={440}>
          <HStack justify="end" padding={3}>
            <IconButton
              icon={<Icon icon="close" />}
              label="Close"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            />
          </HStack>

          {/* The form takes the slack, so a short one sits centred against the
              picture instead of clinging to the top of a tall panel. */}
          <VStack
            className="flex-1"
            justify="center"
            align="stretch"
            gap={4}
            paddingInline={6}
            paddingBlock={2}
          >
            <VStack gap={1} align="stretch">
              {/* Sized like a page title, but still an h2 — it is a heading
                  inside the page, not a second first-level one. */}
              <Heading level={1} accessibilityLevel={2}>
                {title}
              </Heading>
              {subtitle && (
                <Text as="p" type="body" color="secondary" display="block">
                  {subtitle}
                </Text>
              )}
            </VStack>
            {children}
          </VStack>

          {footer && (
            <VStack align="stretch" gap={0}>
              <Divider />
              <HStack justify="end" gap={2} padding={5}>
                {footer}
              </HStack>
            </VStack>
          )}
        </VStack>
      </HStack>
    </Dialog>
  )
}

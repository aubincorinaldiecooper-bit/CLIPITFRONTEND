"use client"

import { useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, Play } from "lucide-react"
import { IconButton } from "@astryxdesign/core/IconButton"
import { Stack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { MediaTheme } from "@astryxdesign/core/theme"
import {
  Carousel,
  Slider,
  SliderContainer,
  SliderDotButton,
  SliderNextButton,
  SliderPrevButton,
  useCarousel,
} from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

export interface CarouselClip {
  id: string
  src: string
  title: string
  description?: string
  videoUrl?: string
}

export interface ClipSliderProps {
  cards: readonly CarouselClip[]
  onSelect: (card: CarouselClip) => void
  onPlay?: (card: CarouselClip) => void
}

function SlideTracker({
  cards,
  onSelect,
}: {
  cards: readonly CarouselClip[]
  onSelect: (card: CarouselClip) => void
}) {
  const { selectedIndex, emblaApi } = useCarousel()
  const last = useRef<number | null>(null)

  useEffect(() => {
    if (selectedIndex !== last.current) {
      last.current = selectedIndex
      const card = cards[selectedIndex]
      if (card) onSelect(card)
    }
  }, [selectedIndex, cards, onSelect])

  useEffect(() => {
    if (emblaApi) {
      emblaApi.reInit()
      emblaApi.scrollTo(0, true)
    }
  }, [cards, emblaApi])

  return null
}

function SlideCard({
  card,
  index,
  onPlay,
}: {
  card: CarouselClip
  index: number
  onPlay?: (card: CarouselClip) => void
}) {
  const { selectedIndex } = useCarousel()
  const isActive = selectedIndex === index

  return (
    <Stack
      padding={0}
      className="relative h-[420px] sm:h-[460px] 2xl:h-[500px] overflow-hidden rounded-lg bg-surface"
    >
      <img
        src={card.src}
        alt={card.title}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
      />

      <Stack
        padding={0}
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
      />

      {card.videoUrl && (
        <Stack
          padding={0}
          vAlign="center"
          hAlign="center"
          className="absolute inset-0 z-20"
        >
          <MediaTheme mode="dark">
            <IconButton
              label={`Play ${card.title}`}
              icon={<Play className="size-5 fill-current" />}
              variant="secondary"
              size="lg"
              elevation="med"
              className={cn(
                "transition-opacity duration-200",
                isActive
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              )}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onPlay?.(card)
              }}
            />
          </MediaTheme>
        </Stack>
      )}

      <Stack
        padding={0}
        vAlign="end"
        hAlign="start"
        className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4"
      >
        <MediaTheme mode="dark">
          <Text type="body" weight="semibold" color="primary" maxLines={2}>
            {card.title}
          </Text>
          {card.description && (
            <Text type="supporting" color="secondary" maxLines={1}>
              {card.description}
            </Text>
          )}
        </MediaTheme>
      </Stack>
    </Stack>
  )
}

export function ClipSlider({ cards, onSelect, onPlay }: ClipSliderProps) {
  if (cards.length === 0) return null

  return (
    <Stack width="100%" maxWidth={560} padding={0}>
      <Carousel options={{ loop: true }} isScale={true}>
        <SliderContainer>
          {cards.map((card, index) => (
            <Slider key={card.id} className="sm:w-[55%] w-[90%]">
              <SlideCard card={card} index={index} onPlay={onPlay} />
            </Slider>
          ))}
        </SliderContainer>
        <SlideTracker cards={cards} onSelect={onSelect} />

        <SliderPrevButton className="absolute top-[50%] p-2 border-2 rounded-full left-4 bg-white/25 dark:bg-black/25 dark:border-white backdrop-blur-xs text-primary disabled:opacity-20 z-20">
          <ChevronLeft className="w-8 h-8" />
        </SliderPrevButton>
        <SliderNextButton className="absolute right-4 p-2 border-2 rounded-full top-[50%] bg-white/25 dark:bg-black/25 dark:border-white backdrop-blur-xs text-primary disabled:opacity-20 z-20">
          <ChevronRight className="w-8 h-8" />
        </SliderNextButton>

        <Stack width="100%" vAlign="center" hAlign="center" paddingBlock={4}>
          <SliderDotButton />
        </Stack>
      </Carousel>
    </Stack>
  )
}

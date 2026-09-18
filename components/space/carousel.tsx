"use client"

import * as React from "react"
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react"

import { cn } from "@/lib/utils"

/**
 * Shadcn Space's carousel, on Embla.
 *
 * Vendored from the owner's reference (Carousel 01 — Custom Dots) rather than
 * pulled in at build time, the same way the rest of components/space is.
 *
 * Two things differ from the published component, both deliberate:
 *
 * Reduced motion is honoured here, directly. Embla animates by writing
 * transforms from a JavaScript loop, so neither MotionConfig nor the CSS
 * guard in globals.css can see it. The query is asked here instead and the
 * scroll duration drops to zero, which lands on the next slide at once
 * instead of gliding — the slide still changes, it just does not travel.
 * The same reasoning is written into coverflow-carousel.tsx.
 *
 * Nothing is unmounted. Every slide stays in the page whether or not it is
 * on screen, which is how a count of what came back stays honest.
 */

export type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

export interface CarouselProps {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  setApi?: (api: CarouselApi) => void
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: CarouselApi
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
}

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

export function useCarousel() {
  const context = React.useContext(CarouselContext)
  if (!context) throw new Error("useCarousel must be used within a <Carousel />")
  return context
}

/** Asked directly, because Embla's animation is invisible to both of the usual guards. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const read = () => setReduced(query.matches)
    read()
    query.addEventListener("change", read)
    return () => query.removeEventListener("change", read)
  }, [])
  return reduced
}

export function Carousel({
  opts,
  plugins,
  setApi,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & CarouselProps) {
  const reduced = usePrefersReducedMotion()
  const [carouselRef, api] = useEmblaCarousel(
    { align: "center", containScroll: false, ...opts, ...(reduced ? { duration: 0 } : {}) },
    plugins,
  )
  const [canScrollPrev, setCanScrollPrev] = React.useState(false)
  const [canScrollNext, setCanScrollNext] = React.useState(false)

  const onSelect = React.useCallback((instance: NonNullable<CarouselApi>) => {
    setCanScrollPrev(instance.canScrollPrev())
    setCanScrollNext(instance.canScrollNext())
  }, [])

  const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api])
  const scrollNext = React.useCallback(() => api?.scrollNext(), [api])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        scrollPrev()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        scrollNext()
      }
    },
    [scrollPrev, scrollNext],
  )

  React.useEffect(() => {
    if (api && setApi) setApi(api)
  }, [api, setApi])

  React.useEffect(() => {
    if (!api) return
    onSelect(api)
    api.on("reInit", onSelect)
    api.on("select", onSelect)
    return () => {
      api.off("reInit", onSelect)
      api.off("select", onSelect)
    }
  }, [api, onSelect])

  return (
    <CarouselContext.Provider
      value={{ carouselRef, api, scrollPrev, scrollNext, canScrollPrev, canScrollNext }}
    >
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

export function CarouselContent({ className, ...props }: React.ComponentProps<"div">) {
  const { carouselRef } = useCarousel()
  return (
    <div ref={carouselRef} className="h-full overflow-hidden">
      <div className={cn("flex h-full", className)} {...props} />
    </div>
  )
}

export function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      className={cn("min-w-0 shrink-0 grow-0 basis-full", className)}
      {...props}
    />
  )
}

export function CarouselPrevious({ className, ...props }: React.ComponentProps<"button">) {
  const { scrollPrev, canScrollPrev } = useCarousel()
  return (
    <button
      type="button"
      aria-label="Previous"
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border border-[#dfe2e6] bg-white text-[#343a42] shadow-[0_1px_2px_rgba(16,20,26,0.06)] transition-colors",
        "hover:bg-[#f5f6f7] disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
      {...props}
    />
  )
}

export function CarouselNext({ className, ...props }: React.ComponentProps<"button">) {
  const { scrollNext, canScrollNext } = useCarousel()
  return (
    <button
      type="button"
      aria-label="Next"
      disabled={!canScrollNext}
      onClick={scrollNext}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border border-[#dfe2e6] bg-white text-[#343a42] shadow-[0_1px_2px_rgba(16,20,26,0.06)] transition-colors",
        "hover:bg-[#f5f6f7] disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
      {...props}
    />
  )
}

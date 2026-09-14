"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

/**
 * Shadcn Space's slider, on Base UI: click, drag, touch and the arrow keys
 * all move it, and it announces its value. Horizontal only here — the one
 * place the app uses it is the moment player's seek bar.
 *
 * Base UI 1.8 marks orientation as `data-orientation="horizontal"`, not the
 * bare `data-horizontal` the registry copy styles against, so the classes
 * are written for a horizontal track directly.
 */
export type SliderProps = Omit<SliderPrimitive.Root.Props, "className"> & { className?: string }

function Slider({ className, defaultValue, value, min = 0, max = 100, ...props }: SliderProps) {
  const thumbs = Array.isArray(value) ? value.length : Array.isArray(defaultValue) ? defaultValue.length : 1

  return (
    <SliderPrimitive.Root
      className={cn("w-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-1 w-full grow overflow-hidden rounded-full bg-shmuted select-none"
        >
          <SliderPrimitive.Indicator data-slot="slider-range" className="h-full bg-shprimary select-none" />
        </SliderPrimitive.Track>
        {Array.from({ length: thumbs }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="relative block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }

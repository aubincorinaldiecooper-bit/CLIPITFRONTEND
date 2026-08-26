"use client"

import { DayPicker, type DayPickerProps } from "react-day-picker"
import { cn } from "@/lib/utils"

/**
 * The month grid behind the landing's "pick a time to post" step.
 *
 * shadcn's Calendar is a thin wrapper over react-day-picker with class names
 * that read from shadcn's CSS variables. This repo has no shadcn, so the
 * classes are written against the landing's own palette instead — ink
 * #121212, band #f7f5f2, line #e8e5e0, grey #6b6965, from
 * lib/landing-tokens.ts.
 *
 * The owner's SchedulePicker deliberately passes only props that exist in both
 * react-day-picker v8 and v9+, so it does not care which is installed. This
 * wrapper does the same: it forwards everything and styles by class name.
 */
export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      className={cn("[--rdp-cell-size:34px]", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-2",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-[.82rem] font-semibold text-[#121212]",
        nav: "flex items-center gap-1",
        button_previous:
          "absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-md text-[#6b6965] hover:bg-[#f7f5f2] disabled:opacity-40",
        button_next:
          "absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-[#6b6965] hover:bg-[#f7f5f2] disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-[34px] text-[.66rem] font-medium uppercase tracking-wide text-[#6b6965]",
        week: "mt-0.5 flex w-full",
        day: "h-[34px] w-[34px] p-0",
        day_button:
          "h-[34px] w-[34px] rounded-md text-[.78rem] text-[#121212] transition-colors hover:bg-[#f7f5f2] disabled:pointer-events-none disabled:text-[#c9c6c1]",
        selected: "[&>button]:bg-[#121212] [&>button]:text-white [&>button:hover]:bg-[#121212]",
        today: "[&>button]:ring-1 [&>button]:ring-[#e8e5e0]",
        outside: "[&>button]:text-[#c9c6c1]",
        disabled: "[&>button]:text-[#c9c6c1]",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  )
}

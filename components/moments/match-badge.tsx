"use client"

import NumberFlow from "@number-flow/react"
import { Sparkles } from "lucide-react"
import { motion } from "motion/react"
import { Badge } from "@/components/space/badge"
import { cn } from "@/lib/utils"

type MatchBadgeProps = {
  value: number
  className?: string
}

export function MatchBadge({ value, className }: MatchBadgeProps) {
  return (
    <Badge
      variant="outline"
      aria-label={`${value}% match`}
      className={cn(
        "h-auto gap-1.5 rounded-full border border-white/35 bg-white/88 px-3 py-1.5 text-[12px] font-semibold text-[#17314a] shadow-[0_8px_24px_rgba(13,38,63,0.12)] backdrop-blur-xl",
        className,
      )}
    >
      <motion.span
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        className="flex items-center justify-center"
      >
        <Sparkles className="size-3.5 fill-[#8ed9ff]/35 text-[#55bdf4]" />
      </motion.span>
      <NumberFlow
        value={value}
        suffix="%"
        transformTiming={{ duration: 650, easing: "ease-out" }}
        spinTiming={{ duration: 650, easing: "ease-out" }}
        opacityTiming={{ duration: 650, easing: "ease-out" }}
      />
      <span className="font-normal text-[#698198]">match</span>
    </Badge>
  )
}

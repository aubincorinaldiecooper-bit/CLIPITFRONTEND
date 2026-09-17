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
        "h-auto gap-1.5 rounded-full border-white/25 bg-black/35 px-3 py-1 text-sm font-semibold text-white backdrop-blur-md",
        className,
      )}
    >
      <motion.span
        animate={{
          scale: [1, 1.12, 0.96, 1.06, 1],
          rotate: [0, -4, 3, -2, 0],
        }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="flex items-center justify-center"
      >
        <Sparkles className="size-3.5 fill-white/20 text-white" />
      </motion.span>

      <NumberFlow
        value={value}
        suffix="%"
        transformTiming={{ duration: 700, easing: "ease-out" }}
        spinTiming={{ duration: 700, easing: "ease-out" }}
        opacityTiming={{ duration: 700, easing: "ease-out" }}
      />

      <span className="font-normal text-white/70">match</span>
    </Badge>
  )
}

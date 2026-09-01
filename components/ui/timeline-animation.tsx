"use client"

import type { Variants } from "motion/react"
import { type HTMLMotionProps, motion, useInView, useReducedMotion } from "motion/react"
import type React from "react"
import { useRef } from "react"

type TimelineContentProps<T extends keyof HTMLElementTagNameMap> = {
  children?: React.ReactNode
  animationNum: number
  className?: string
  as?: T
  customVariants?: Variants
  once?: boolean
} & HTMLMotionProps<T>

export const TimelineAnimation = <T extends keyof HTMLElementTagNameMap = "div">({
  children,
  animationNum,
  className,
  as,
  customVariants,
  once = true,
  ...props
}: TimelineContentProps<T>) => {
  const reducedMotion = useReducedMotion()
  const ref = useRef<HTMLElement>(null)

  const defaultSequenceVariants = {
    visible: (i: number) => ({
      filter: "blur(0px)",
      y: 0,
      opacity: 1,
      transition: {
        // Cap the stagger so deep cards do not wait seconds after they scroll
        // into view. A short local stagger still feels stepped.
        delay: Math.min(i, 3) * 0.05,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(20px)",
      y: 0,
      opacity: 0,
    },
  }

  const sequenceVariants = customVariants || defaultSequenceVariants

  const isInView = useInView(ref, { once })

  const MotionComponent = motion[as || "div"] as React.ElementType

  if (reducedMotion) {
    const Component = (as || "div") as React.ElementType
    return (
      <Component className={className} {...props}>
        {children}
      </Component>
    )
  }

  return (
    <MotionComponent
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      custom={animationNum}
      variants={sequenceVariants}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  )
}

"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

// Spring physics configuration
const SPRING = {
  type: "spring" as const,
  damping: 15,
  mass: 0.5,
  stiffness: 100,
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator asChild>
      <motion.div
        className="h-full bg-primary relative overflow-hidden"
        initial={{ width: 0 }}
        animate={{ width: `${value || 0}%` }}
        transition={SPRING}
      >
        {/* Shimmer effect - sadece dolu alanda */}
        <div className="absolute inset-0 animate-shimmer pointer-events-none" />
      </motion.div>
    </ProgressPrimitive.Indicator>
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }

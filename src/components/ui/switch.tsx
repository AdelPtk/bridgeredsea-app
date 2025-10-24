import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // MUI iOS-like: 42x26 track, 2px padding, 22px thumb; ON should slide left in RTL
      "peer inline-flex h-[26px] w-[42px] shrink-0 cursor-pointer items-center rounded-full p-[2px] overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-500 data-[state=checked]:bg-[#65C466] data-[state=unchecked]:bg-[#E9E9EA]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // 22px thumb moves exactly 16px inside 42px track with 2px padding
        "pointer-events-none block h-[22px] w-[22px] rounded-full bg-white shadow-lg ring-0 transition-transform duration-300",
        // Always move left on ON (checked)
        "data-[state=checked]:translate-x-0 data-[state=unchecked]:translate-x-[16px]"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }

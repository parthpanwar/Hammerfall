import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 active:bg-blue-700",
        destructive: "bg-red-600 text-white shadow-lg shadow-red-600/25 hover:bg-red-500 active:bg-red-700",
        outline: "border border-gray-600 bg-transparent text-gray-200 hover:bg-gray-800 hover:text-white",
        secondary: "bg-gray-700 text-gray-200 hover:bg-gray-600",
        ghost: "text-gray-400 hover:bg-gray-800 hover:text-white",
        link: "text-blue-400 underline-offset-4 hover:underline",
        gold: "bg-gradient-to-r from-yellow-600 to-amber-500 text-black font-bold shadow-lg shadow-amber-500/25 hover:from-yellow-500 hover:to-amber-400",
        success: "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }


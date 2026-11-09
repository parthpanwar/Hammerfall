import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
}>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: "bg-blue-600/20 text-blue-400 border-blue-500/30",
    secondary: "bg-gray-700/50 text-gray-300 border-gray-600/30",
    destructive: "bg-red-600/20 text-red-400 border-red-500/30",
    outline: "bg-transparent text-gray-400 border-gray-600",
    success: "bg-emerald-600/20 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-600/20 text-amber-400 border-amber-500/30",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  )
})
Badge.displayName = "Badge"

export { Badge }


import * as React from "react"
import { cn } from "@/lib/utils"

interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  size?: "sm" | "md" | "lg"
  strokeWidth?: number
}

const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  ({ className, value = 0, size = "sm", strokeWidth = 3, ...props }, ref) => {
    const radius = size === "sm" ? 16 : size === "md" ? 24 : 32
    const circumference = 2 * Math.PI * radius
    const progress = Math.min(100, Math.max(0, value))
    const offset = circumference - (progress / 100) * circumference

    const sizeClass = {
      sm: "h-10 w-10",
      md: "h-14 w-14",
      lg: "h-20 w-20",
    }

    return (
      <div
        ref={ref}
        className={cn("relative inline-flex items-center justify-center", sizeClass[size], className)}
        {...props}
      >
        <svg className="absolute h-full w-full -rotate-90">
          {/* Background circle */}
          <circle
            className="text-muted-foreground/20"
            fill="none"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            r={radius}
            cx="50%"
            cy="50%"
          />
          {/* Progress circle */}
          <circle
            className="text-primary transition-all duration-300 ease-in-out"
            fill="none"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            r={radius}
            cx="50%"
            cy="50%"
          />
        </svg>
        <span className="absolute text-xs font-medium">{Math.round(progress)}%</span>
      </div>
    )
  }
)

CircularProgress.displayName = "CircularProgress"

export { CircularProgress } 
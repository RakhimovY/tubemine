import { cn } from "@/lib/utils"

export function Progress({
  value,
  variant = "primary",
  className,
}: {
  value?: number
  variant?: "primary" | "destructive"
  className?: string
}) {
  const isIndeterminate = value === undefined || value === null

  return (
    <div
      role="progressbar"
      aria-valuemin={isIndeterminate ? undefined : 0}
      aria-valuemax={isIndeterminate ? undefined : 100}
      aria-valuenow={isIndeterminate ? undefined : value}
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        data-slot="progress-indicator"
        className={cn(
          "h-full rounded-full transition-all duration-300",
          variant === "destructive"
            ? "bg-destructive"
            : "bg-foreground",
          isIndeterminate &&
            "absolute w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite]"
        )}
        style={isIndeterminate ? undefined : { width: `${value}%` }}
      />
    </div>
  )
}

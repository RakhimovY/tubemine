import { cn } from "@/lib/utils"

// Anthropic Claude sunburst/asterisk mark (simplified 8-spoke radial)
export default function ClaudeLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      {/* 8-spoke asterisk radiating from center, Anthropic-style */}
      <g transform="translate(12,12)">
        <rect x="-1.5" y="-9" width="3" height="18" rx="1.5" />
        <rect x="-1.5" y="-9" width="3" height="18" rx="1.5" transform="rotate(45)" />
        <rect x="-1.5" y="-9" width="3" height="18" rx="1.5" transform="rotate(90)" />
        <rect x="-1.5" y="-9" width="3" height="18" rx="1.5" transform="rotate(135)" />
      </g>
    </svg>
  )
}

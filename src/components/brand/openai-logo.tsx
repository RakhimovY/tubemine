import { cn } from "@/lib/utils"

// OpenAI blossom/knot mark - 6 rotated capsule petals forming a rosette
export default function OpenAILogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      <g transform="translate(12,12)">
        {/* 6 rounded petals, each rotated 60 degrees */}
        <ellipse cx="0" cy="-5.5" rx="2.2" ry="4.2" />
        <ellipse cx="0" cy="-5.5" rx="2.2" ry="4.2" transform="rotate(60)" />
        <ellipse cx="0" cy="-5.5" rx="2.2" ry="4.2" transform="rotate(120)" />
        <ellipse cx="0" cy="-5.5" rx="2.2" ry="4.2" transform="rotate(180)" />
        <ellipse cx="0" cy="-5.5" rx="2.2" ry="4.2" transform="rotate(240)" />
        <ellipse cx="0" cy="-5.5" rx="2.2" ry="4.2" transform="rotate(300)" />
        {/* Center circle to create knot effect */}
        <circle cx="0" cy="0" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </g>
    </svg>
  )
}

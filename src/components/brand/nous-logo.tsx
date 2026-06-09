import { cn } from "@/lib/utils"

// Nous Research - monogram fallback: rounded square with "N" initial
export default function NousLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      {/* Rounded square outline */}
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {/* "N" monogram centered */}
      <path
        d="M7.5 17V7L12 14.5V7M12 14.5V17M16.5 7V17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

import { cn } from "@/lib/utils"

// OpenClaw - monogram fallback: circle outline with "OC" initials
export default function OpenClawLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      {/* Circle outline */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {/* Lobster-claw / pincer shape inside the circle */}
      <path
        d="M8 15 C8 15 7 12 9 10 C11 8 13 9 13 11 C13 13 11 13 11 11.5
           M11 11.5 C11 10 13 10 14.5 11 C16 12 16 14.5 14.5 15.5 C13 16.5 11 16 10 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

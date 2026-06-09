import { cn } from "@/lib/utils"

// Cursor IDE logo - geometric cube/box mark
export default function CursorLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      {/*
        Cursor logo: a stylized cursor/box shape.
        Two overlapping squares forming the Cursor "C" box mark.
      */}
      <rect x="2" y="2" width="9" height="9" rx="1.5" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" />
      <rect x="13" y="13" width="9" height="9" rx="1.5" opacity="0.4" />
    </svg>
  )
}

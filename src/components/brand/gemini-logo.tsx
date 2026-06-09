import { cn } from "@/lib/utils"

// Google Gemini spark/star mark - 4-pointed star with concave sides
export default function GeminiLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      {/*
        Gemini logo: a 4-pointed star with bezier-curved concave sides.
        The distinctive "spark" shape used by Google Gemini.
        Path: top point -> right concave arc -> right point -> bottom concave arc
              -> bottom point -> left concave arc -> left point -> top concave arc -> close
      */}
      <path d="
        M12 2
        C12 2 12.8 7.2 16.8 8.8
        C20.8 10.4 22 12 22 12
        C22 12 20.8 13.6 16.8 15.2
        C12.8 16.8 12 22 12 22
        C12 22 11.2 16.8 7.2 15.2
        C3.2 13.6 2 12 2 12
        C2 12 3.2 10.4 7.2 8.8
        C11.2 7.2 12 2 12 2
        Z
      " />
    </svg>
  )
}

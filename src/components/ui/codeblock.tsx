"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function CodeBlock({
  label,
  code,
  children,
  className,
}: {
  label?: string
  code: string
  children?: React.ReactNode
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard not available in some environments; silently fail
    }
  }, [code])

  return (
    <div
      data-slot="codeblock"
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-muted text-sm",
        className
      )}
    >
      {label && (
        <div
          data-slot="codeblock-label"
          className="border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground"
        >
          {label}
        </div>
      )}

      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy code"}
        className={cn(
          "absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        )}
      >
        {copied ? (
          <>
            <CheckIcon className="size-3" />
            Copied
          </>
        ) : (
          <>
            <CopyIcon className="size-3" />
            Copy
          </>
        )}
      </button>

      <pre className="overflow-x-auto p-4 pr-20 text-foreground">
        <code>{children ?? code}</code>
      </pre>
    </div>
  )
}

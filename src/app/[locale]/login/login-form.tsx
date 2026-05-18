"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

export function LoginForm() {
  const search = useSearchParams()
  const next = search.get("next") ?? "/"
  const errorParam = search.get("error")
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setLoading(true)
    try {
      const supabase = createClient()
      const redirectTo = new URL(
        "/auth/callback",
        window.location.origin,
      )
      redirectTo.searchParams.set("next", next)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo.toString() },
      })
      if (error) {
        toast.error(error.message)
        setLoading(false)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm border-border/60 shadow-xl shadow-black/5">
      <CardContent className="p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Continue with Google to start analyzing comments.
          </p>
        </div>

        {errorParam ? (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-center text-xs text-destructive">
            {errorParam === "missing_code"
              ? "Sign-in was interrupted. Try again."
              : errorParam}
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <GoogleIcon />
              Sign in with Google
            </>
          )}
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By signing in you agree to use TubeMine for analyzing public YouTube
          comments responsibly.
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Back to home
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

function GoogleIcon() {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.48-1.12 2.73-2.39 3.57v2.96h3.86c2.26-2.08 3.58-5.15 3.58-8.77z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.96c-1.07.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.05C3.25 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.33c-.24-.72-.38-1.49-.38-2.33s.14-1.61.38-2.33V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.05z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.29 6.62l3.98 3.05C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { z } from "zod"
import { Loader2, Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

const FormSchema = z.object({
  email: z.string().email("Enter a valid email"),
})
type FormValues = z.infer<typeof FormSchema>

export function LoginForm() {
  const search = useSearchParams()
  const redirect = search.get("redirect") ?? "/dashboard"
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(FormSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const supabase = createClient()
      const callback = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: { emailRedirectTo: callback },
      })
      if (error) {
        toast.error(error.message)
        return
      }
      setSent(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm border-border/60 shadow-xl shadow-black/5">
      <CardContent className="p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Get a magic link in your inbox. No password.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
            <Mail className="mx-auto size-5 text-foreground/70" />
            <p className="mt-2 text-sm font-medium">Check your email</p>
            <p className="mt-1 text-xs text-muted-foreground">
              We sent a sign-in link to{" "}
              <span className="text-foreground">{form.getValues("email")}</span>
              . Click it to continue.
            </p>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-xs font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                disabled={loading}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Send magic link"
              )}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Back to home
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

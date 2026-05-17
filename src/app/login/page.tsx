import { Suspense } from "react"
import { LoginForm } from "./login-form"

export const metadata = {
  title: "Sign in - TubeMine",
  description: "Sign in to TubeMine with Google.",
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-16">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}

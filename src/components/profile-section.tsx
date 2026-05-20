import { ReactNode } from "react"

export function ProfileSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="grid md:grid-cols-[200px_1fr] gap-4 md:gap-8 py-6 border-b border-border/40 last:border-b-0">
      <header>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  )
}

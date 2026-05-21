export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="h-24 w-full animate-pulse rounded bg-muted" />
      <div className="mt-6 h-32 animate-pulse rounded bg-muted" />
      <div className="mt-6 h-64 animate-pulse rounded bg-muted" />
    </div>
  )
}

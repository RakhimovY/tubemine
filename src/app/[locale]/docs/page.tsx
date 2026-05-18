import { setRequestLocale } from "next-intl/server"

export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold">Docs</h1>
      <p className="mt-4 text-muted-foreground">
        Documentation content will land here via Track A.
      </p>
    </main>
  )
}

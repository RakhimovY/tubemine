import { getTranslations } from "next-intl/server"

export async function TrustLine() {
  const t = await getTranslations("pricing")
  // Hardcoded number per spec (not parametrized - we want the smallness to feel real, update manually as it grows).
  return (
    <p className="mt-6 text-center text-sm text-muted-foreground">
      {t("trust_line")}
    </p>
  )
}

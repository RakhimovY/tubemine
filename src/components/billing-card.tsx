import { getTranslations } from "next-intl/server"
import NextLink from "next/link"
import { ArrowUpRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

export async function BillingCard() {
  const t = await getTranslations("profile.billing")
  return (
    <div className="space-y-3 text-sm">
      <NextLink
        href="/api/portal"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {t("manage")}
        <ArrowUpRight className="size-3.5" />
      </NextLink>
    </div>
  )
}

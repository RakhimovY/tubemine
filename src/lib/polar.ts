import "server-only"
import { Polar } from "@polar-sh/sdk"

let clientInstance: Polar | null = null

export function getPolarClient(): Polar {
  if (clientInstance) return clientInstance

  const accessToken = process.env.POLAR_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN must be set")
  }

  const server =
    (process.env.NEXT_PUBLIC_POLAR_SERVER as "sandbox" | "production") ??
    "sandbox"

  clientInstance = new Polar({ accessToken, server })
  return clientInstance
}

export async function createProCheckout(params: {
  userId: string
  customerEmail: string
  successUrl: string
}): Promise<{ checkoutUrl: string; checkoutId: string }> {
  const productId = process.env.POLAR_PRODUCT_PRO_ID
  if (!productId) {
    throw new Error("POLAR_PRODUCT_PRO_ID must be set")
  }

  const polar = getPolarClient()

  const checkout = await polar.checkouts.create({
    products: [productId],
    customerEmail: params.customerEmail,
    successUrl: params.successUrl,
    metadata: { userId: params.userId },
  })

  return {
    checkoutUrl: checkout.url,
    checkoutId: checkout.id,
  }
}

export async function cancelPolarSubscription(
  subscriptionId: string,
): Promise<void> {
  const polar = getPolarClient()
  await polar.subscriptions.update({
    id: subscriptionId,
    subscriptionUpdate: { cancelAtPeriodEnd: true },
  })
}

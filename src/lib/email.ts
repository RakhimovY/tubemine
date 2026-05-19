import "server-only"
import { Resend } from "resend"

const FROM =
  process.env.RESEND_FROM ?? "TubeMine <onboarding@resend.dev>"

let cached: Resend | null = null

function client(): Resend | null {
  if (cached) return cached
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  cached = new Resend(key)
  return cached
}

export async function sendWelcomeEmail(to: string): Promise<void> {
  const r = client()
  if (!r) {
    console.warn("[email] RESEND_API_KEY not set; skipping welcome email")
    return
  }
  try {
    await r.emails.send({
      from: FROM,
      to,
      subject: "Welcome to TubeMine",
      html: welcomeHtml(),
      text: welcomeText(),
    })
  } catch (err) {
    console.error("[email] sendWelcomeEmail failed:", err)
  }
}

function welcomeHtml(): string {
  const origin = process.env.NEXT_PUBLIC_ORIGIN ?? "https://tubemine.vercel.app"
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0a0a0a">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fafafa">
      <tr>
        <td align="center" style="padding:40px 16px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px">
            <tr>
              <td style="padding:32px 32px 24px">
                <h1 style="margin:0 0 12px;font-size:22px;font-weight:600">Welcome to TubeMine</h1>
                <p style="margin:0 0 16px;line-height:1.55;color:#404040">
                  Thanks for signing up. You can now analyze up to <strong>5,000 comments per month</strong> on the free plan.
                </p>
                <p style="margin:0 0 24px;line-height:1.55;color:#404040">
                  Need more? Pro unlocks <strong>100,000 comments per month</strong> for $19.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#0a0a0a;border-radius:10px">
                      <a href="${origin}/dashboard" style="display:inline-block;padding:10px 18px;color:#fafafa;text-decoration:none;font-weight:500;font-size:14px">Open dashboard</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;border-top:1px solid #f0f0f0;font-size:12px;color:#737373;line-height:1.5">
                TubeMine analyzes public YouTube comments and exports the dataset as research-ready CSV. Source on GitHub: <a href="https://github.com/RakhimovY/tubemine" style="color:#525252">RakhimovY/tubemine</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function welcomeText(): string {
  const origin = process.env.NEXT_PUBLIC_ORIGIN ?? "https://tubemine.vercel.app"
  return [
    "Welcome to TubeMine",
    "",
    "Thanks for signing up. The free plan gives you 5,000 comments per month.",
    "Pro unlocks 100,000 comments per month for $19.",
    "",
    `Dashboard: ${origin}/dashboard`,
    "",
    "Source on GitHub: https://github.com/RakhimovY/tubemine",
  ].join("\n")
}

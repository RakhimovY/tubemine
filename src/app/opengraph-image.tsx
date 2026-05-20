import { ImageResponse } from "next/og"

export const alt = "TubeMine, YouTube Audience Analytics. Free. No Setup."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#18181b"/><stop offset="100%" stop-color="#2a2a2e"/></linearGradient></defs><rect width="64" height="64" rx="15" ry="15" fill="url(#g)" stroke="rgba(245,245,247,0.12)" stroke-width="1"/><path d="M26 20 L26 44 L43 32 Z" fill="#f5f5f7" fill-opacity="0.95"/></svg>`
const BRAND_MARK_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(BRAND_MARK_SVG)}`

async function loadFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

export default async function OpenGraphImage() {
  const [bold, regular] = await Promise.all([
    loadFont(
      "https://github.com/vercel/geist-font/raw/main/packages/geist-font/fonts/Geist/Geist-Bold.ttf",
    ),
    loadFont(
      "https://github.com/vercel/geist-font/raw/main/packages/geist-font/fonts/Geist/Geist-Medium.ttf",
    ),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background:
            "radial-gradient(circle at 78% 22%, #f59e0b35 0%, transparent 32%), radial-gradient(circle at 62% 28%, #6366f155 0%, transparent 48%), linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)",
          padding: "72px",
          fontFamily: '"Geist", system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "24px",
            left: "24px",
            right: "24px",
            bottom: "24px",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "16px",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            alignSelf: "flex-start",
            marginBottom: "auto",
          }}
        >
          <img
            src={BRAND_MARK_DATA_URI}
            width={64}
            height={64}
            alt=""
            style={{ display: "block" }}
          />
          <div
            style={{
              color: "#f5f5f7",
              fontSize: "38px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            TubeMine
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              fontSize: "84px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
            }}
          >
            Understand any
          </div>
          <div
            style={{
              fontSize: "84px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
              marginTop: "4px",
            }}
          >
            YouTube audience.
          </div>
          <div
            style={{
              fontSize: "44px",
              fontWeight: 700,
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
              marginTop: "20px",
            }}
          >
            Free. No setup.
          </div>
          <div
            style={{
              fontSize: "26px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.6)",
              marginTop: "28px",
              letterSpacing: "-0.01em",
            }}
          >
            Sentiment, top words, and emoji insights in seconds.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "60px",
            right: "84px",
            fontSize: "22px",
            color: "rgba(255,255,255,0.4)",
            fontWeight: 500,
          }}
        >
          tubemine.tech
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(bold
          ? [
              {
                name: "Geist",
                data: bold,
                weight: 700 as const,
                style: "normal" as const,
              },
            ]
          : []),
        ...(regular
          ? [
              {
                name: "Geist",
                data: regular,
                weight: 500 as const,
                style: "normal" as const,
              },
            ]
          : []),
      ],
    },
  )
}

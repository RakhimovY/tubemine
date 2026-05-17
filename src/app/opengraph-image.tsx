import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "TubeMine, YouTube Audience Analytics. Free. No Setup."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

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
            padding: "10px 22px",
            borderRadius: "999px",
            border: "1px solid rgba(99, 102, 241, 0.45)",
            color: "#a5b4fc",
            fontSize: "22px",
            fontWeight: 500,
            background: "rgba(15, 23, 42, 0.7)",
            alignSelf: "flex-start",
            marginBottom: "auto",
          }}
        >
          TubeMine
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
          tubemine.vercel.app
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

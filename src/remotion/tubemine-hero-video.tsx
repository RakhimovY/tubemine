import { Audio } from "@remotion/media"
import type { CSSProperties, ReactNode } from "react"
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

type Scene = {
  label: string
  start: number
  end: number
}

const COLORS = {
  bg: "#000000",
  raised: "#0f0f11",
  sunken: "#0a0a0c",
  primary: "#f5f5f7",
  secondary: "#b9b9c0",
  tertiary: "#7a7a82",
  border: "rgba(245,245,247,0.14)",
  borderSoft: "rgba(245,245,247,0.08)",
  red: "#ff2d2d",
  redSoft: "rgba(255,45,45,0.14)",
  green: "rgba(52,211,153,0.9)",
  greenSoft: "rgba(52,211,153,0.14)",
  danger: "rgba(251,113,133,0.85)",
}

const SCENES: Scene[] = [
  { label: "Connect AI", start: 0, end: 7 },
  { label: "Ask with URL", start: 7, end: 14 },
  { label: "Pull comments", start: 14, end: 22 },
  { label: "See insights", start: 22, end: 30 },
]

const WORDS = [
  { word: "tutorial", count: "847", pct: 1 },
  { word: "workflow", count: "662", pct: 0.78 },
  { word: "helpful", count: "543", pct: 0.64 },
  { word: "editing", count: "449", pct: 0.53 },
]

const COMMENTS = [
  ["@sarah_makes", "This workflow finally makes the editing process click."],
  ["@mike.travels", "What mic did you use for this voiceover? It sounds clean."],
  ["@priya.films", "The color matching section was exactly what I needed."],
]

function seconds(value: number, fps: number) {
  return value * fps
}

function clampInterpolate(
  frame: number,
  input: [number, number],
  output: [number, number],
) {
  return interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0, 0, 1),
  })
}

function useSceneProgress(scene: Scene) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return clampInterpolate(
    frame,
    [seconds(scene.start, fps), seconds(scene.end, fps)],
    [0, 1],
  )
}

function useSceneOpacity(scene: Scene) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const fadeIn = clampInterpolate(
    frame,
    [seconds(scene.start, fps), seconds(scene.start + 0.7, fps)],
    [0, 1],
  )
  const fadeOut = clampInterpolate(
    frame,
    [seconds(scene.end - 0.7, fps), seconds(scene.end, fps)],
    [1, 0],
  )
  return fadeIn * fadeOut
}

function Card({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        background: `linear-gradient(180deg, #151518 0%, ${COLORS.raised} 100%)`,
        borderRadius: 28,
        boxShadow:
          "0 52px 130px -52px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.04)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function WindowBar({ title, badge }: { title: string; badge?: string }) {
  return (
    <div
      style={{
        height: 68,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 26px",
        borderBottom: `1px solid ${COLORS.borderSoft}`,
      }}
    >
      <div style={{ display: "flex", gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "rgba(245,245,247,0.16)",
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: COLORS.secondary,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 20,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            background: COLORS.red,
            boxShadow: `0 0 24px ${COLORS.red}`,
          }}
        />
        {title}
      </div>
      {badge ? (
        <div
          style={{
            marginLeft: "auto",
            color: COLORS.red,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 16,
            letterSpacing: 0,
            textTransform: "uppercase",
          }}
        >
          {badge}
        </div>
      ) : null}
    </div>
  )
}

function ProgressRail() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const currentSecond = frame / fps

  return (
    <div
      style={{
        position: "absolute",
        left: 84,
        right: 84,
        bottom: 52,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 14,
      }}
    >
      {SCENES.map((scene) => {
        const fill = clampInterpolate(
          currentSecond,
          [scene.start, scene.end],
          [0, 1],
        )
        const active = currentSecond >= scene.start && currentSecond < scene.end
        return (
          <div key={scene.label}>
            <div
              style={{
                height: 5,
                borderRadius: 999,
                overflow: "hidden",
                background: "rgba(245,245,247,0.08)",
              }}
            >
              <div
                style={{
                  width: `${fill * 100}%`,
                  height: "100%",
                  background: active ? COLORS.red : "rgba(245,245,247,0.32)",
                }}
              />
            </div>
            <div
              style={{
                marginTop: 10,
                color: active ? COLORS.primary : COLORS.tertiary,
                fontSize: 16,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {scene.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function IntroScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = useSceneProgress(SCENES[0])
  const opacity = useSceneOpacity(SCENES[0])
  const y = interpolate(p, [0, 0.14], [38, 0], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  })
  const cardScale = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.8 },
  })

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 168,
          width: 720,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 18px",
            borderRadius: 999,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.secondary,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 22,
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 99,
              background: COLORS.green,
              boxShadow: `0 0 0 7px ${COLORS.greenSoft}`,
            }}
          />
          Works in Claude, ChatGPT, Cursor and Codex
        </div>
        <h1
          style={{
            margin: "34px 0 0",
            color: COLORS.primary,
            fontSize: 86,
            lineHeight: 0.98,
            letterSpacing: 0,
            fontWeight: 650,
          }}
        >
          YouTube comments,
          <br />
          inside your AI assistant.
        </h1>
        <p
          style={{
            margin: "30px 0 0",
            color: COLORS.secondary,
            fontSize: 32,
            lineHeight: 1.38,
            maxWidth: 680,
          }}
        >
          Ask one question. Get the full thread, sentiment, top words and emoji
          in seconds.
        </p>
      </div>

      <Card
        style={{
          position: "absolute",
          right: 112,
          top: 156,
          width: 748,
          height: 604,
          transform: `scale(${0.94 + cardScale * 0.06})`,
        }}
      >
        <WindowBar title="claude mcp" badge="connected" />
        <div style={{ padding: 34 }}>
          {[
            ["$", "claude mcp add TubeMine"],
            [">", "connecting to tubemine.tech"],
            ["✓", "authorized with API key"],
            ["✓", "1 tool registered: get_youtube_comments"],
          ].map(([prefix, text], i) => {
            const rowP = clampInterpolate(
              frame,
              [seconds(0.8 + i * 0.75, fps), seconds(1.4 + i * 0.75, fps)],
              [0, 1],
            )
            return (
              <div
                key={text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  marginBottom: 24,
                  opacity: rowP,
                  transform: `translateX(${(1 - rowP) * -26}px)`,
                  color: prefix === "✓" ? COLORS.green : COLORS.secondary,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 28,
                }}
              >
                <span style={{ color: prefix === "✓" ? COLORS.green : COLORS.red }}>
                  {prefix}
                </span>
                <span style={{ color: COLORS.primary }}>{text}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </AbsoluteFill>
  )
}

function ChatScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = useSceneProgress(SCENES[1])
  const opacity = useSceneOpacity(SCENES[1])
  const typed = Math.floor(clampInterpolate(p, [0.08, 0.45], [0, 78]))
  const prompt =
    "Analyze the comments on youtube.com/watch?v=k8Lq2 and tell me what viewers care about."

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translateY(${clampInterpolate(p, [0, 0.16], [44, 0])}px)`,
      }}
    >
      <Card
        style={{
          position: "absolute",
          left: 180,
          top: 126,
          width: 1560,
          height: 734,
        }}
      >
        <WindowBar title="Claude - TubeMine connected" badge="MCP" />
        <div style={{ padding: 48 }}>
          <div
            style={{
              marginLeft: "auto",
              width: 1010,
              borderRadius: 28,
              background: COLORS.red,
              color: "#140806",
              padding: "28px 32px",
              fontSize: 32,
              lineHeight: 1.42,
              fontWeight: 600,
            }}
          >
            {prompt.slice(0, typed)}
            <span style={{ opacity: frame % 28 < 14 ? 1 : 0 }}>|</span>
          </div>
          <div
            style={{
              marginTop: 42,
              display: "flex",
              gap: 24,
              alignItems: "flex-start",
              opacity: clampInterpolate(p, [0.48, 0.62], [0, 1]),
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                display: "grid",
                placeItems: "center",
                color: COLORS.red,
                background: COLORS.redSoft,
                border: `1px solid rgba(255,45,45,0.36)`,
                fontSize: 24,
              }}
            >
              *
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 20px",
                  borderRadius: 16,
                  background: "rgba(245,245,247,0.05)",
                  border: `1px solid ${COLORS.border}`,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 24,
                  color: COLORS.secondary,
                }}
              >
                <span style={{ color: COLORS.red }}>tool</span>
                <span style={{ color: COLORS.primary }}>
                  get_youtube_comments()
                </span>
                <span style={{ color: COLORS.green }}>ready</span>
              </div>
              <p
                style={{
                  margin: "24px 0 0",
                  color: COLORS.primary,
                  fontSize: 32,
                  lineHeight: 1.45,
                }}
              >
                Calling TubeMine for the full comment thread.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </AbsoluteFill>
  )
}

function PullScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = useSceneProgress(SCENES[2])
  const opacity = useSceneOpacity(SCENES[2])
  const count = Math.floor(clampInterpolate(p, [0.12, 0.62], [0, 19422]))
  const coverage = Math.floor(clampInterpolate(p, [0.26, 0.68], [0, 92]))

  return (
    <AbsoluteFill
      style={{
        opacity,
      }}
    >
      <Card
        style={{
          position: "absolute",
          left: 112,
          top: 132,
          width: 1696,
          height: 760,
        }}
      >
        <WindowBar title="TubeMine result payload" badge="live" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.92fr 1.08fr",
            gap: 38,
            padding: 44,
            height: "calc(100% - 68px)",
          }}
        >
          <div
            style={{
              borderRadius: 24,
              background: COLORS.sunken,
              border: `1px solid ${COLORS.borderSoft}`,
              padding: 36,
            }}
          >
            <div
              style={{
                color: COLORS.tertiary,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 20,
                textTransform: "uppercase",
                letterSpacing: 0,
              }}
            >
              Comments analyzed
            </div>
            <div
              style={{
                marginTop: 18,
                color: COLORS.primary,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 86,
                letterSpacing: 0,
              }}
            >
              {count.toLocaleString("en-US")}
            </div>
            <div
              style={{
                marginTop: 26,
                height: 28,
                borderRadius: 999,
                display: "flex",
                overflow: "hidden",
                background: "rgba(245,245,247,0.08)",
              }}
            >
              <span
                style={{
                  width: `${clampInterpolate(p, [0.32, 0.7], [0, 68])}%`,
                  background: COLORS.green,
                }}
              />
              <span
                style={{
                  width: `${clampInterpolate(p, [0.44, 0.78], [0, 24])}%`,
                  background: "rgba(245,245,247,0.34)",
                }}
              />
              <span
                style={{
                  width: `${clampInterpolate(p, [0.56, 0.86], [0, 8])}%`,
                  background: COLORS.danger,
                }}
              />
            </div>
            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "space-between",
                color: COLORS.secondary,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 20,
              }}
            >
              <span>68% positive</span>
              <span>{coverage}% coverage</span>
            </div>
          </div>
          <div style={{ display: "grid", gap: 18 }}>
            {COMMENTS.map(([author, text], i) => {
              const rowP = clampInterpolate(
                frame,
                [seconds(15.6 + i * 0.6, fps), seconds(16.2 + i * 0.6, fps)],
                [0, 1],
              )
              return (
                <div
                  key={author}
                  style={{
                    padding: "22px 26px",
                    borderRadius: 18,
                    border: `1px solid ${COLORS.borderSoft}`,
                    background: "rgba(245,245,247,0.025)",
                    opacity: rowP,
                    transform: `translateY(${(1 - rowP) * 20}px)`,
                  }}
                >
                  <div
                    style={{
                      color: COLORS.secondary,
                      fontSize: 20,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}
                  >
                    {author}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      color: COLORS.primary,
                      fontSize: 28,
                      lineHeight: 1.3,
                    }}
                  >
                    {text}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </AbsoluteFill>
  )
}

function InsightsScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = useSceneProgress(SCENES[3])
  const opacity = useSceneOpacity(SCENES[3])

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${clampInterpolate(p, [0, 0.18], [0.975, 1])})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 112,
          top: 116,
          right: 112,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              color: COLORS.tertiary,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 20,
              textTransform: "uppercase",
              letterSpacing: 0,
            }}
          >
            TubeMine dashboard
          </div>
          <h2
            style={{
              margin: "12px 0 0",
              maxWidth: 980,
              color: COLORS.primary,
              fontSize: 58,
              lineHeight: 1,
              letterSpacing: 0,
              fontWeight: 650,
            }}
          >
            Save the result. Keep the history. Ask again later.
          </h2>
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            color: "#08080a",
            fontSize: 24,
            fontWeight: 650,
          }}
        >
          {["Save CSV", "Save JSON", "Save Excel"].map((label, i) => (
            <span
              key={label}
              style={{
                padding: "15px 20px",
                borderRadius: 999,
                background: i === 0 ? COLORS.primary : "rgba(245,245,247,0.12)",
                color: i === 0 ? "#08080a" : COLORS.secondary,
                border: i === 0 ? "none" : `1px solid ${COLORS.border}`,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 112,
          right: 112,
          top: 300,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 24,
        }}
      >
        <Widget title="Sentiment" delay={22.5}>
          <div
            style={{
              color: COLORS.primary,
              fontSize: 38,
              fontWeight: 650,
              marginBottom: 22,
            }}
          >
            Mostly positive
          </div>
          <div
            style={{
              height: 26,
              borderRadius: 999,
              overflow: "hidden",
              display: "flex",
              background: "rgba(245,245,247,0.08)",
            }}
          >
            <span style={{ width: "68%", background: COLORS.green }} />
            <span style={{ width: "24%", background: "rgba(245,245,247,0.36)" }} />
            <span style={{ width: "8%", background: COLORS.danger }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 18,
              color: COLORS.secondary,
              fontSize: 20,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            <span>positive</span>
            <span>neutral</span>
            <span>negative</span>
          </div>
        </Widget>

        <Widget title="Top words" delay={23.2}>
          <div style={{ display: "grid", gap: 18 }}>
            {WORDS.map((row) => (
              <div
                key={row.word}
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 1fr 60px",
                  alignItems: "center",
                  gap: 16,
                  color: COLORS.secondary,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 21,
                }}
              >
                <span style={{ color: COLORS.primary }}>{row.word}</span>
                <span
                  style={{
                    display: "block",
                    height: 12,
                    borderRadius: 999,
                    background: "rgba(245,245,247,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${clampInterpolate(p, [0.18, 0.7], [0, row.pct * 100])}%`,
                      borderRadius: 999,
                      background: COLORS.primary,
                    }}
                  />
                </span>
                <span>{row.count}</span>
              </div>
            ))}
          </div>
        </Widget>

        <Widget title="Emoji" delay={23.9}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 14,
            }}
          >
            {[
              [String.fromCodePoint(0x1f525), "18.2%"],
              [`${String.fromCodePoint(0x2764)}${String.fromCodePoint(0xfe0f)}`, "14.7%"],
              [String.fromCodePoint(0x1f44f), "11.3%"],
              [String.fromCodePoint(0x1f4af), "9.6%"],
            ].map(([emoji, pct]) => (
              <div
                key={emoji}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 18px",
                  borderRadius: 16,
                  border: `1px solid ${COLORS.borderSoft}`,
                  background: "rgba(245,245,247,0.03)",
                }}
              >
                <span style={{ fontSize: 34 }}>{emoji}</span>
                <span
                  style={{
                    color: COLORS.secondary,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 22,
                  }}
                >
                  {pct}
                </span>
              </div>
            ))}
          </div>
        </Widget>
      </div>

      <div
        style={{
          position: "absolute",
          left: 112,
          right: 112,
          bottom: 134,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 18,
          opacity: clampInterpolate(frame, [seconds(26.4, fps), seconds(27.2, fps)], [0, 1]),
        }}
      >
        {["History saved", "Quota tracked", "MCP ready"].map((label) => (
          <div
            key={label}
            style={{
              borderRadius: 18,
              padding: "20px 24px",
              color: COLORS.primary,
              background: COLORS.greenSoft,
              border: `1px solid rgba(52,211,153,0.34)`,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 22,
            }}
          >
            <span style={{ color: COLORS.green, marginRight: 12 }}>✓</span>
            {label}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

function Widget({
  title,
  delay,
  children,
}: {
  title: string
  delay: number
  children: ReactNode
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const inP = clampInterpolate(
    frame,
    [seconds(delay, fps), seconds(delay + 0.7, fps)],
    [0, 1],
  )
  return (
    <Card
      style={{
        minHeight: 288,
        padding: 30,
        opacity: inP,
        transform: `translateY(${(1 - inP) * 28}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 26,
          color: COLORS.secondary,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 21,
        }}
      >
        <span>{title}</span>
        <span style={{ color: COLORS.green }}>live</span>
      </div>
      {children}
    </Card>
  )
}

export function TubeMineHeroVideo() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const gridOpacity = interpolate(frame, [0, seconds(2, fps)], [0.18, 0.08], {
    extrapolateRight: "clamp",
  })

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        color: COLORS.primary,
        fontFamily:
          "SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        overflow: "hidden",
      }}
    >
      <Audio src={staticFile("videos/tubemine-hero-voiceover.mp3")} volume={0.9} />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(255,45,45,0.18), transparent 42%), radial-gradient(circle at 80% 40%, rgba(52,211,153,0.10), transparent 34%)",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: gridOpacity,
          backgroundImage:
            "linear-gradient(rgba(245,245,247,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(245,245,247,0.18) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 84,
          right: 84,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Img
            src={staticFile("brand/brand-mark.svg")}
            style={{ width: 42, height: 42 }}
          />
          <span style={{ fontSize: 28, fontWeight: 650 }}>TubeMine</span>
        </div>
        <div
          style={{
            color: COLORS.tertiary,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 18,
          }}
        >
          YouTube audience analytics over MCP
        </div>
      </div>

      <IntroScene />
      <ChatScene />
      <PullScene />
      <InsightsScene />
      <ProgressRail />
    </AbsoluteFill>
  )
}

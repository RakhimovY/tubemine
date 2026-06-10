import { Audio } from "@remotion/media"
import type { CSSProperties, ReactNode } from "react"
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

type Scene = {
  start: number
  end: number
}

type Locale = "en" | "ru"

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
  { start: 0, end: 6 },
  { start: 6, end: 16 },
  { start: 16, end: 26 },
  { start: 26, end: 38 },
  { start: 38, end: 42 },
]

const COPY = {
  en: {
    locale: "en",
    numberLocale: "en-US",
    topLine: "raw YouTube comments for your AI, dashboard analytics in the web app",
    scenes: ["Signal", "Raw thread", "Your AI", "Dashboard", "Next step"],
    hook: {
      eyebrow: "audience signal, without the scroll",
      title: "Your next video idea is already in the comments",
      windowTitle: "youtube.com/watch?v=k8Lq2",
      badge: "public",
      countLabel: "comment thread",
      bullets: ["questions", "complaints", "requests", "buying intent"],
    },
    mcp: {
      prompt:
        "Pull the comments from this video and tell me what viewers are asking for",
      windowTitle: "Claude - TubeMine connected",
      badge: "MCP",
      toolLabel: "tool",
      toolText: "TubeMine fetches the raw thread, your AI does the reasoning",
      rawCountUnit: "raw comments",
      returned: "JSON returned",
      rawComments: [
        ["@sarah_makes", "The audio ducking tip fixed the part I always struggle with", "1,240"],
        ["@mike.travels", "Can you share the exact preset chain for voiceover", "312"],
        ["@priya.films", "The chapter on color matching is the reason I saved this", "209"],
        ["@design.daily", "People keep asking for a downloadable checklist", "188"],
      ],
    },
    analysis: {
      eyebrow: "not a canned report",
      title: "Your model reads the comments and answers your question",
      themes: [
        ["Audio workflow", "32% of high-like comments"],
        ["Preset requests", "recurring buying intent"],
        ["Editing checklist", "best follow-up content"],
      ],
      nextPromptLabel: "next prompt",
      nextPrompt:
        "“Turn those requests into a pinned comment, a follow-up video outline, and three thumbnail angles”",
    },
    webapp: {
      eyebrow: "web app path",
      title: "Prefer ready widgets? Paste the same URL in TubeMine",
      exports: ["Save CSV", "Save JSON", "Save Excel"],
      sentiment: "Sentiment",
      mostlyPositive: "Mostly positive",
      positive: "positive",
      neutral: "neutral",
      negative: "negative",
      topWords: "Top words",
      emoji: "Emoji",
      words: [
        { word: "workflow", count: "847", pct: 1 },
        { word: "audio", count: "662", pct: 0.78 },
        { word: "preset", count: "543", pct: 0.64 },
        { word: "checklist", count: "449", pct: 0.53 },
      ],
      bottom: ["History saved", "Quota tracked", "Exports ready"],
    },
    close: {
      title: "Turn raw comments into your next move",
      sub: "Pull the thread over MCP, let your AI find the signal",
    },
    live: "live",
    voiceover: "videos/tubemine-hero-voiceover.mp3",
  },
  ru: {
    locale: "ru",
    numberLocale: "ru-RU",
    topLine: "сырые комментарии YouTube для вашего AI, аналитика в веб-приложении",
    scenes: ["Сигнал", "Сырая ветка", "Ваш AI", "Дашборд", "Следующий шаг"],
    hook: {
      eyebrow: "сигнал аудитории без ручного скролла",
      title: "Идея для следующего видео уже лежит в комментариях",
      windowTitle: "youtube.com/watch?v=k8Lq2",
      badge: "публично",
      countLabel: "ветка комментариев",
      bullets: ["вопросы", "жалобы", "запросы", "интерес к покупке"],
    },
    mcp: {
      prompt:
        "Вытащи комментарии к этому видео и покажи, о чем чаще всего спрашивают зрители",
      windowTitle: "Claude - TubeMine подключён",
      badge: "MCP",
      toolLabel: "инструмент",
      toolText: "TubeMine получает сырую ветку, анализ делает ваш AI",
      rawCountUnit: "сырых комментариев",
      returned: "JSON получен",
      rawComments: [
        ["@sarah_makes", "Совет по звуку наконец закрыл проблему, с которой я всегда мучилась", "1 240"],
        ["@mike.travels", "Можешь показать точную цепочку пресетов для озвучки", "312"],
        ["@priya.films", "Глава про цветокоррекцию - причина, почему я сохранила видео", "209"],
        ["@design.daily", "Все просят чеклист, который можно скачать", "188"],
      ],
    },
    analysis: {
      eyebrow: "не заготовленный отчёт",
      title: "Ваша модель читает комментарии и отвечает на ваш вопрос",
      themes: [
        ["Работа со звуком", "32% комментариев с лайками"],
        ["Запросы пресетов", "покупательский сигнал"],
        ["Чеклист монтажа", "лучшая тема для продолжения"],
      ],
      nextPromptLabel: "следующий промпт",
      nextPrompt:
        "«Преврати эти запросы в закреплённый комментарий, план следующего видео и три идеи для обложки»",
    },
    webapp: {
      eyebrow: "путь через веб-приложение",
      title: "Нужны готовые виджеты? Вставьте ту же ссылку в TubeMine",
      exports: ["Сохранить CSV", "Сохранить JSON", "Сохранить Excel"],
      sentiment: "Тональность",
      mostlyPositive: "В основном позитив",
      positive: "позитив",
      neutral: "нейтрально",
      negative: "негатив",
      topWords: "Топ слов",
      emoji: "Эмодзи",
      words: [
        { word: "процесс", count: "847", pct: 1 },
        { word: "звук", count: "662", pct: 0.78 },
        { word: "пресет", count: "543", pct: 0.64 },
        { word: "чеклист", count: "449", pct: 0.53 },
      ],
      bottom: ["История сохранена", "Квота учтена", "Экспорт готов"],
    },
    close: {
      title: "Превратите сырые комментарии в следующий шаг",
      sub: "Получите ветку через MCP, пусть ваш AI найдёт сигнал",
    },
    live: "активно",
    voiceover: "videos/tubemine-hero-voiceover-ru.mp3",
  },
} as const

type Copy = (typeof COPY)[Locale]

function seconds(value: number, fps: number) {
  return Math.round(value * fps)
}

function ease(
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
  return ease(frame, [seconds(scene.start, fps), seconds(scene.end, fps)], [0, 1])
}

function useSceneOpacity(scene: Scene) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const fadeIn = ease(
    frame,
    [seconds(scene.start, fps), seconds(scene.start + 0.55, fps)],
    [0, 1],
  )
  const fadeOut = ease(
    frame,
    [seconds(scene.end - 0.55, fps), seconds(scene.end, fps)],
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
        height: 70,
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
              background: i === 2 ? COLORS.red : "rgba(245,245,247,0.16)",
              boxShadow: i === 2 ? `0 0 18px ${COLORS.red}` : undefined,
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
        {title}
      </div>
      {badge ? (
        <div
          style={{
            marginLeft: "auto",
            color: COLORS.red,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 16,
            textTransform: "uppercase",
          }}
        >
          {badge}
        </div>
      ) : null}
    </div>
  )
}

function TopChrome({ copy }: { copy: Copy }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 50,
        left: 84,
        right: 84,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 10,
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
        {copy.topLine}
      </div>
    </div>
  )
}

function ProgressRail({ copy }: { copy: Copy }) {
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
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 14,
        zIndex: 10,
      }}
    >
      {SCENES.map((scene, index) => {
        const fill = ease(currentSecond, [scene.start, scene.end], [0, 1])
        const active = currentSecond >= scene.start && currentSecond < scene.end
        return (
          <div key={copy.scenes[index]}>
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
              }}
            >
              {copy.scenes[index]}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HookScene({ copy }: { copy: Copy }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const scene = SCENES[0]
  const p = useSceneProgress(scene)
  const opacity = useSceneOpacity(scene)
  const count = Math.floor(ease(p, [0.1, 0.74], [0, 19422]))
  const scale = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 76, mass: 0.9 },
  })

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 170,
          width: 780,
          transform: `translateY(${ease(p, [0, 0.16], [34, 0])}px)`,
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
          {copy.hook.eyebrow}
        </div>
        <h1
          style={{
            margin: "34px 0 0",
            color: COLORS.primary,
            fontSize: copy.locale === "ru" ? 76 : 86,
            lineHeight: 0.98,
            fontWeight: 650,
          }}
        >
          {copy.hook.title}
        </h1>
      </div>

      <Card
        style={{
          position: "absolute",
          right: 112,
          top: 172,
          width: 748,
          height: 560,
          transform: `scale(${0.94 + scale * 0.06})`,
        }}
      >
        <WindowBar title={copy.hook.windowTitle} badge={copy.hook.badge} />
        <div style={{ padding: 42 }}>
          <div
            style={{
              color: COLORS.tertiary,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 20,
              textTransform: "uppercase",
            }}
          >
            {copy.hook.countLabel}
          </div>
          <div
            style={{
              marginTop: 18,
              color: COLORS.primary,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 92,
              lineHeight: 1,
            }}
          >
            {count.toLocaleString(copy.numberLocale)}
          </div>
          <div
            style={{
              marginTop: 34,
              display: "grid",
              gap: 16,
            }}
          >
            {copy.hook.bullets.map((label, i) => {
                const rowP = ease(
                  frame,
                  [seconds(1.2 + i * 0.35, fps), seconds(1.9 + i * 0.35, fps)],
                  [0, 1],
                )
                return (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      opacity: rowP,
                      transform: `translateX(${(1 - rowP) * -18}px)`,
                      color: COLORS.secondary,
                      fontSize: 27,
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 99,
                        background: i === 0 ? COLORS.red : COLORS.green,
                      }}
                    />
                    {label}
                  </div>
                )
              })}
          </div>
        </div>
      </Card>
    </AbsoluteFill>
  )
}

function McpCallScene({ copy }: { copy: Copy }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const scene = SCENES[1]
  const p = useSceneProgress(scene)
  const opacity = useSceneOpacity(scene)
  const prompt = copy.mcp.prompt
  const typed = Math.floor(ease(p, [0.05, 0.35], [0, prompt.length]))
  const rawCount = Math.floor(ease(p, [0.54, 0.82], [0, 2000]))

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translateY(${ease(p, [0, 0.12], [34, 0])}px)`,
      }}
    >
      <Card
        style={{
          position: "absolute",
          left: 120,
          top: 144,
          width: 1680,
          height: 760,
        }}
      >
        <WindowBar title={copy.mcp.windowTitle} badge={copy.mcp.badge} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.95fr 1.05fr",
            gap: 38,
            padding: 44,
          }}
        >
          <div>
            <div
              style={{
                marginLeft: "auto",
                width: 710,
                borderRadius: 28,
                background: COLORS.red,
                color: "#140806",
                padding: "28px 32px",
                fontSize: 32,
                lineHeight: 1.42,
                fontWeight: 650,
              }}
            >
              {prompt.slice(0, typed)}
              <span style={{ opacity: frame % 28 < 14 ? 1 : 0 }}>|</span>
            </div>
            <div
              style={{
                marginTop: 42,
                display: "flex",
                gap: 22,
                alignItems: "flex-start",
                opacity: ease(p, [0.38, 0.48], [0, 1]),
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
                  <span style={{ color: COLORS.red }}>{copy.mcp.toolLabel}</span>
                  <span style={{ color: COLORS.primary }}>
                    get_youtube_comments()
                  </span>
                </div>
                <p
                  style={{
                    margin: "24px 0 0",
                    color: COLORS.secondary,
                    fontSize: 28,
                    lineHeight: 1.42,
                  }}
                >
                  {copy.mcp.toolText}
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              borderRadius: 24,
              background: COLORS.sunken,
              border: `1px solid ${COLORS.borderSoft}`,
              padding: 30,
              minHeight: 596,
              opacity: ease(p, [0.5, 0.62], [0, 1]),
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  color: COLORS.primary,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 42,
                }}
              >
                {rawCount.toLocaleString(copy.numberLocale)}
                <span style={{ color: COLORS.tertiary, fontSize: 18 }}>
                  {" "}
                  {copy.mcp.rawCountUnit}
                </span>
              </div>
              <span
                style={{
                  color: COLORS.green,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 18,
                }}
              >
                {copy.mcp.returned}
              </span>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {copy.mcp.rawComments.map(([author, text, likes], i) => {
                const rowP = ease(
                  frame,
                  [seconds(11 + i * 0.45, fps), seconds(11.7 + i * 0.45, fps)],
                  [0, 1],
                )
                return (
                  <div
                    key={author}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "150px 1fr 70px",
                      gap: 18,
                      alignItems: "start",
                      padding: "16px 18px",
                      borderRadius: 16,
                      border: `1px solid ${COLORS.borderSoft}`,
                      background: "rgba(245,245,247,0.025)",
                      opacity: rowP,
                      transform: `translateY(${(1 - rowP) * 16}px)`,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 17,
                    }}
                  >
                    <span style={{ color: COLORS.secondary }}>{author}</span>
                    <span style={{ color: COLORS.primary }}>{text}</span>
                    <span style={{ color: COLORS.tertiary }}>{likes}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>
    </AbsoluteFill>
  )
}

function ModelAnalysisScene({ copy }: { copy: Copy }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const scene = SCENES[2]
  const p = useSceneProgress(scene)
  const opacity = useSceneOpacity(scene)

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 162,
          right: 120,
          display: "grid",
          gridTemplateColumns: "0.88fr 1.12fr",
          gap: 44,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              color: COLORS.tertiary,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 20,
              textTransform: "uppercase",
            }}
          >
            {copy.analysis.eyebrow}
          </div>
          <h2
            style={{
              margin: "18px 0 0",
              color: COLORS.primary,
              fontSize: copy.locale === "ru" ? 70 : 78,
              lineHeight: 1.02,
              fontWeight: 650,
            }}
          >
            {copy.analysis.title}
          </h2>
        </div>
        <Card style={{ height: 642, padding: 34 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 18,
            }}
          >
            {copy.analysis.themes.map(([title, sub], i) => {
              const rowP = ease(
                frame,
                [seconds(17.3 + i * 1.05, fps), seconds(18.2 + i * 1.05, fps)],
                [0, 1],
              )
              return (
                <div
                  key={title}
                  style={{
                    borderRadius: 22,
                    border: `1px solid ${COLORS.borderSoft}`,
                    background:
                      i === 0 ? COLORS.greenSoft : "rgba(245,245,247,0.03)",
                    padding: "24px 28px",
                    opacity: rowP,
                    transform: `translateX(${(1 - rowP) * 24}px)`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 18,
                    }}
                  >
                    <span
                      style={{
                        color: COLORS.primary,
                        fontSize: 34,
                        fontWeight: 650,
                      }}
                    >
                      {title}
                    </span>
                    <span
                      style={{
                        color: i === 0 ? COLORS.green : COLORS.secondary,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: copy.locale === "ru" ? 18 : 20,
                      }}
                    >
                      {sub}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div
            style={{
              marginTop: 34,
              borderRadius: 22,
              background: COLORS.redSoft,
              border: `1px solid rgba(255,45,45,0.32)`,
              padding: 28,
              opacity: ease(p, [0.62, 0.75], [0, 1]),
            }}
          >
            <div
              style={{
                color: COLORS.red,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 20,
                marginBottom: 12,
              }}
            >
              {copy.analysis.nextPromptLabel}
            </div>
            <div
              style={{
                color: COLORS.primary,
                fontSize: 31,
                lineHeight: 1.36,
                fontWeight: 600,
              }}
            >
              {copy.analysis.nextPrompt}
            </div>
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  )
}

function WebAppScene({ copy }: { copy: Copy }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const scene = SCENES[3]
  const p = useSceneProgress(scene)
  const opacity = useSceneOpacity(scene)

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${ease(p, [0, 0.18], [0.975, 1])})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 112,
          top: 130,
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
            }}
          >
            {copy.webapp.eyebrow}
          </div>
          <h2
            style={{
              margin: "12px 0 0",
              maxWidth: 1040,
              color: COLORS.primary,
              fontSize: copy.locale === "ru" ? 56 : 64,
              lineHeight: 1.04,
              fontWeight: 650,
            }}
          >
            {copy.webapp.title}
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
          {copy.webapp.exports.map((label, i) => (
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
          top: 336,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 24,
        }}
      >
        <Widget title={copy.webapp.sentiment} live={copy.live} delay={27.2}>
          <div
            style={{
              color: COLORS.primary,
              fontSize: 38,
              fontWeight: 650,
              marginBottom: 22,
            }}
          >
            {copy.webapp.mostlyPositive}
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
            <span>{copy.webapp.positive}</span>
            <span>{copy.webapp.neutral}</span>
            <span>{copy.webapp.negative}</span>
          </div>
        </Widget>

        <Widget title={copy.webapp.topWords} live={copy.live} delay={28}>
          <div style={{ display: "grid", gap: 18 }}>
            {copy.webapp.words.map((row) => (
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
                      width: `${ease(p, [0.18, 0.7], [0, row.pct * 100])}%`,
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

        <Widget title={copy.webapp.emoji} live={copy.live} delay={28.8}>
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
          bottom: 132,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 18,
          opacity: ease(frame, [seconds(32.2, fps), seconds(33.1, fps)], [0, 1]),
        }}
      >
        {copy.webapp.bottom.map((label) => (
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

function CloseScene({ copy }: { copy: Copy }) {
  const scene = SCENES[4]
  const p = useSceneProgress(scene)
  const opacity = useSceneOpacity(scene)
  return (
    <AbsoluteFill
      style={{
        opacity,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "min(1080px, calc(100% - 320px))",
          maxWidth: 1080,
          transform: `translateY(${ease(p, [0, 0.22], [32, 0])}px)`,
        }}
      >
        <Img
          src={staticFile("brand/brand-mark.svg")}
          style={{ width: 84, height: 84, margin: "0 auto 28px" }}
        />
        <h2
          style={{
            margin: 0,
            color: COLORS.primary,
            fontSize: copy.locale === "ru" ? 64 : 72,
            lineHeight: 1.05,
            fontWeight: 650,
          }}
        >
          {copy.close.title}
        </h2>
        <p
          style={{
            margin: "28px auto 0",
            color: COLORS.secondary,
            fontSize: 30,
            lineHeight: 1.42,
            maxWidth: 760,
          }}
        >
          {copy.close.sub}
        </p>
      </div>
    </AbsoluteFill>
  )
}

function Widget({
  title,
  live,
  delay,
  children,
}: {
  title: string
  live: string
  delay: number
  children: ReactNode
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const inP = ease(frame, [seconds(delay, fps), seconds(delay + 0.7, fps)], [0, 1])
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
        <span style={{ color: COLORS.green }}>{live}</span>
      </div>
      {children}
    </Card>
  )
}

function SoundDesign({ copy }: { copy: Copy }) {
  const { fps } = useVideoConfig()
  return (
    <>
      <Audio src={staticFile(copy.voiceover)} volume={0.92} />
      <Audio src={staticFile("videos/sfx-bed.mp3")} volume={0.18} />
      {[6, 16, 26, 38].map((s) => (
        <Sequence key={`whoosh-${s}`} from={seconds(s - 0.08, fps)}>
          <Audio src={staticFile("videos/sfx-whoosh.wav")} volume={0.28} />
        </Sequence>
      ))}
      {[1.2, 1.55, 1.9, 2.25, 10.8, 11.25, 11.7, 12.15].map((s) => (
        <Sequence key={`click-${s}`} from={seconds(s, fps)}>
          <Audio src={staticFile("videos/sfx-click.wav")} volume={0.2} />
        </Sequence>
      ))}
      {[20.3, 21.35, 22.4, 33.1].map((s) => (
        <Sequence key={`ding-${s}`} from={seconds(s, fps)}>
          <Audio src={staticFile("videos/sfx-ding.wav")} volume={0.22} />
        </Sequence>
      ))}
    </>
  )
}

export function TubeMineHeroVideo({ locale = "en" }: { locale?: Locale }) {
  const copy = COPY[locale]
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
      <SoundDesign copy={copy} />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 34% 0%, rgba(255,45,45,0.18), transparent 42%), radial-gradient(circle at 86% 42%, rgba(52,211,153,0.10), transparent 34%)",
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
      <TopChrome copy={copy} />
      <HookScene copy={copy} />
      <McpCallScene copy={copy} />
      <ModelAnalysisScene copy={copy} />
      <WebAppScene copy={copy} />
      <CloseScene copy={copy} />
      <ProgressRail copy={copy} />
    </AbsoluteFill>
  )
}

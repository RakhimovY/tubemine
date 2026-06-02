"use client"

import { useTranslations } from "next-intl"
import { Link as IntlLink } from "@/i18n/navigation"

/*
  Static promo block shown to anonymous visitors on the landing page demo
  section as an educational preview of what TubeMine analysis output looks
  like. Rendered ONLY when TubeMine has no real preview and no real
  results to show — once the user pastes a URL or analyzes a video the
  placeholder must disappear so the real output is not visually confused
  with the static sample.

  Direct port of the design's #demoResult promo card. Translations come
  from the landing.demo.sample namespace so this component is fully
  self-contained and can be conditionally mounted by TubeMine.
*/
export function DemoSampleResult() {
  const t = useTranslations("landing.demo.sample")

  return (
    <div
      className="demo-result"
      style={{ marginTop: "var(--space-7)" }}
      aria-live="polite"
    >
      <div className="demo-result-head">
        <div className="thumb" aria-hidden="true">
          <span className="thumb-duration">{t("duration")}</span>
        </div>
        <div>
          <h3 className="demo-meta-title">{t("title")}</h3>
          <div className="demo-meta-channel">{t("channel")}</div>
          <div className="demo-meta-stats">
            <span>
              <strong>19,422</strong> {t("stats_analyzed")}
            </span>
            <span>
              <strong>847K</strong> {t("stats_views")}
            </span>
            <span>
              <strong>32K</strong> {t("stats_likes")}
            </span>
            <span>{t("stats_lang")}</span>
          </div>
        </div>
      </div>

      <div className="widget-grid">
        <div className="widget">
          <div className="widget-head">
            <span className="widget-title">{t("sentiment_title")}</span>
            <span className="widget-sub">{t("sentiment_sub")}</span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-family-mono)",
              marginBottom: 4,
            }}
          >
            {t("sentiment_analyzed")}
          </div>
          <div
            style={{
              fontSize: 16,
              color: "var(--color-text-primary)",
              fontWeight: 500,
              letterSpacing: "-0.005em",
              marginBottom: "var(--space-4)",
            }}
          >
            {t("sentiment_label")}
          </div>
          <div className="sentiment-bar" role="img" aria-label="">
            <span className="sentiment-pos" style={{ width: "68%" }} />
            <span className="sentiment-neu" style={{ width: "24%" }} />
            <span className="sentiment-neg" style={{ width: "8%" }} />
          </div>
          <div className="sentiment-legend">
            <span>
              <span className="legend-dot legend-pos" />
              {t("legend_pos")}
            </span>
            <span>
              <span className="legend-dot legend-neu" />
              {t("legend_neu")}
            </span>
            <span>
              <span className="legend-dot legend-neg" />
              {t("legend_neg")}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-family-mono)",
            }}
          >
            {t("sentiment_foot")}
          </div>
        </div>

        <div className="widget">
          <div className="widget-head">
            <span className="widget-title">{t("top_words_title")}</span>
            <span className="widget-sub">{t("top_words_sub")}</span>
          </div>
          <div className="tw-list">
            {[
              { w: "tutorial", pct: 100, n: "847" },
              { w: "love", pct: 78, n: "662" },
              { w: "workflow", pct: 64, n: "543" },
              { w: "helpful", pct: 53, n: "449" },
              { w: "thanks", pct: 47, n: "398" },
              { w: "editing", pct: 43, n: "364" },
              { w: "camera", pct: 36, n: "307" },
              { w: "amazing", pct: 31, n: "261" },
            ].map((row) => (
              <div key={row.w} className="tw-row">
                <span className="tw-word">{row.w}</span>
                <span className="tw-bar">
                  <span style={{ width: `${row.pct}%` }} />
                </span>
                <span className="tw-count">{row.n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="widget">
          <div className="widget-head">
            <span className="widget-title">{t("emoji_title")}</span>
            <span className="widget-sub">{t("emoji_sub")}</span>
          </div>
          <div className="emoji-grid">
            {[
              { g: "🔥", pct: 100, p: "18.2%" },
              { g: "❤️", pct: 81, p: "14.7%" },
              { g: "👏", pct: 62, p: "11.3%" },
              { g: "💯", pct: 53, p: "9.6%" },
              { g: "😍", pct: 46, p: "8.4%" },
              { g: "🙏", pct: 40, p: "7.2%" },
              { g: "👍", pct: 37, p: "6.8%" },
              { g: "😂", pct: 32, p: "5.9%" },
              { g: "⚡", pct: 25, p: "4.5%" },
              { g: "💪", pct: 17, p: "3.1%" },
            ].map((row, i) => (
              <div key={i} className="emoji-row">
                <span className="glyph">{row.g}</span>
                <span className="pct-bar">
                  <span style={{ width: `${row.pct}%` }} />
                </span>
                <span className="pct">{row.p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card comments-card">
        <div
          className="widget-head"
          style={{ marginBottom: "var(--space-3)" }}
        >
          <span className="widget-title">{t("comments_title")}</span>
          <span className="widget-sub">{t("comments_sub")}</span>
        </div>
        <div className="comments-list">
          {SAMPLE_COMMENTS.map((c, i) => (
            <div key={i} className="comment-row">
              <span className="comment-author">{c.author}</span>
              <span className="comment-text">{c.text}</span>
              <span className={`comment-sent ${c.kind}`}>
                <span className="dot" />
                {c.kind === "pos"
                  ? t("sent_pos")
                  : c.kind === "neg"
                    ? t("sent_neg")
                    : t("sent_neu")}
              </span>
            </div>
          ))}
        </div>
        <div className="comments-foot">
          <span>{t("comments_foot")}</span>
          <IntlLink
            href="/login?intent=signup"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {t("comments_foot_cta")}
          </IntlLink>
        </div>
      </div>
    </div>
  )
}

const SAMPLE_COMMENTS: Array<{
  author: string
  text: string
  kind: "pos" | "neu" | "neg"
}> = [
  {
    author: "@sarah_makes",
    text: "This is the workflow video I've needed for months 🔥 The premiere shortcut at 4:12 alone is worth a sub. Thank you!",
    kind: "pos",
  },
  {
    author: "@mike.travels",
    text: "Quick question, what mic are you using for the voiceover? It sounds amazing.",
    kind: "neu",
  },
  {
    author: "@designdaily",
    text: "Love the part about cutting B-roll first. I always do it last and it slows me down so much. Trying this tomorrow ❤️",
    kind: "pos",
  },
  {
    author: "@noahcodes",
    text: "Sponsored sections in the middle were kind of jarring tbh, but the actual tutorial parts were 💯",
    kind: "neu",
  },
  {
    author: "@priya.films",
    text: "Way too long. Could've been a 6 min video honestly.",
    kind: "neg",
  },
]

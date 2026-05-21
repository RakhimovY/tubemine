# TUB-31 Docs + Changelog Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub pages at `src/app/[locale]/docs/page.tsx` and `src/app/[locale]/changelog/page.tsx` with production-grade bilingual content. Two commits total (one per page) with verify-on-prod gate between them.

**Architecture:** Two server-component pages. Each defines a const `sections` array and iterates it twice (sticky TOC + body), matching the privacy/terms pattern. Bilingual chrome via `next-intl`; docs body fully bilingual; changelog body EN-only with the existing `legal_disclaimer_ru_changelog` banner above the hero.

**Tech Stack:** Next.js 16 App Router, TypeScript, `next-intl`, existing `.legal-page` CSS scope in `src/app/globals.css`, no new dependencies, no new components, no API changes.

**Spec:** `docs/superpowers/specs/2026-05-21-tub-30-docs-changelog-content-design.md` (commits `cf85f7c`, `8e66a9f`, `7619731`, `ea343ce`, `c494753`, `c702ce3`).

---

## Hard constraints (every task respects these)

- No em-dash (U+2014) or en-dash (U+2013) anywhere in new files or message keys (spec § 9.1).
- Source attribution: every claim traces to README, `pricing.*` keys, codebase strings, or git/Linear history (spec § 2). Inline `{/* SRC: ... */}` JSX comments on each section body per spec § 8 (convention, not gate-enforced).
- RU number formatting: byte-equal to shipped `messages/ru.json` (`"1 000"`, `"5 000"`, `"100 000"` with U+0020 plain ASCII space, NOT thin-space, NOT NBSP per spec § 6.3).
- Quoted English error strings in Section 07 stay English in RU body (spec § 4.7.1).
- File scope locked: `src/app/[locale]/docs/page.tsx`, `src/app/[locale]/changelog/page.tsx`, `messages/en.json`, `messages/ru.json`. Do not touch site-header, (app)/, pricing, privacy, terms, API routes, payments.
- Footer pattern: verbatim duplication from `src/app/[locale]/terms/page.tsx` (legal footer + SOCIALS array). Matches existing convention; future shared-component refactor out of scope.
- `LAST_UPDATED = "May 21, 2026"` constant on both pages (single shared value).

---

## PR 1: Docs page

Single commit on `main` after all PR-1 tasks pass local smoke and verify-on-prod gate.

### Task 1: Scaffold docs page shell with empty sections array

**Files:**
- Modify: `src/app/[locale]/docs/page.tsx` (replace 19-line stub with full scaffold)

- [ ] **Step 1: Replace the stub with the scaffold.** Open `src/app/[locale]/docs/page.tsx` and replace the entire file with:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { LegalToc } from "@/components/legal-toc"

const REPO_URL = "https://github.com/RakhimovY/tubemine"
const SUPPORT_EMAIL = "hello@tubemine.app"
const LAST_UPDATED = "May 21, 2026"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "docs.meta" })
  return {
    title: t("title"),
    description: t("description"),
  }
}

/*
  TUB-31 Docs content sprint (page 1 of 2).
  Reuses the .legal-page CSS scope shipped on /privacy and /terms.
  Inline <script> behavior lives in one client island reused as-is:
    - LegalToc: IntersectionObserver active-section highlight + smooth-scroll.
*/
export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("docs")
  const tLanding = await getTranslations("landing")

  const sections = [
    // Sections will be appended by Tasks 2-9.
  ]

  return (
    <div className="legal-page">
      <LegalToc />

      <main>
        <section className="legal-hero">
          <div className="container">
            <span className="legal-badge">{t("hero.badge")}</span>
            <h1 className="legal-title">{t("hero.title")}</h1>
            <p className="legal-sub">{t("hero.sub")}</p>
            <p className="legal-updated">
              {t("hero.updated_label")}: {LAST_UPDATED}
            </p>
          </div>
        </section>

        <section className="legal-body">
          <div className="container legal-grid">
            <aside className="toc" aria-label={t("toc.aria")}>
              <h3>{t("toc.heading")}</h3>
              <ol>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.tocLabel}</a>
                  </li>
                ))}
              </ol>
            </aside>

            <article className="legal-article">
              {sections.map((s) => (
                <section key={s.id} id={s.id}>
                  <h2>
                    <span className="num">{s.num}</span> {s.title}
                  </h2>
                  {s.body}
                </section>
              ))}
            </article>
          </div>
        </section>
      </main>

      <DocsFooter tLanding={tLanding} />
    </div>
  )
}

function DocsFooter({
  tLanding,
}: {
  tLanding: Awaited<ReturnType<typeof getTranslations<"landing">>>
}) {
  // VERBATIM copy of the LegalFooter function in src/app/[locale]/terms/page.tsx
  // including the full SOCIALS array. Future shared-component refactor out of scope.
  return null // PLACEHOLDER - replaced by Task 1 Step 2.
}

const SOCIALS: Array<{ label: string; url: string; icon: React.ReactNode }> = []
```

- [ ] **Step 2: Copy the verbatim footer and SOCIALS array.** Open `src/app/[locale]/terms/page.tsx`, copy lines 238-420 (the `LegalFooter` function plus the `SOCIALS` constant array). Paste in place of the placeholder `DocsFooter` function and empty `SOCIALS` constant from Step 1. Rename the function to `DocsFooter` (only the function name changes; everything else is verbatim).

- [ ] **Step 3: Add hero, toc, and meta i18n keys (EN).** Open `messages/en.json`. Locate the existing `"dashboard"` key (alphabetical position). Add the new `"docs"` block immediately after `"dashboard"` and before `"extractor"`:

```json
"docs": {
  "meta": {
    "title": "Docs | TubeMine",
    "description": "How to use TubeMine: quick start, plans, output formats, limits, and common errors."
  },
  "hero": {
    "badge": "Docs",
    "title": "How to use TubeMine.",
    "sub": "Quick start, plans, output formats, limits, and common errors.",
    "updated_label": "Last updated"
  },
  "toc": {
    "aria": "Sections",
    "heading": "On this page"
  },
  "sections": {}
},
```

- [ ] **Step 4: Add hero, toc, and meta i18n keys (RU).** Open `messages/ru.json`. Same alphabetical position (after `"dashboard"`, before `"extractor"`). Add:

```json
"docs": {
  "meta": {
    "title": "Документация | TubeMine",
    "description": "Как пользоваться TubeMine: быстрый старт, тарифы, форматы экспорта, лимиты и частые ошибки."
  },
  "hero": {
    "badge": "Документация",
    "title": "Как пользоваться TubeMine.",
    "sub": "Быстрый старт, тарифы, форматы экспорта, лимиты и частые ошибки.",
    "updated_label": "Обновлено"
  },
  "toc": {
    "aria": "Разделы",
    "heading": "На этой странице"
  },
  "sections": {}
},
```

- [ ] **Step 5: Typecheck.** Run `pnpm tsc --noEmit`. Expected: no errors. (The empty `sections` array satisfies the iterator; the `s.id` etc. accesses do not execute on an empty array.)

---

### Task 2: Add Section 01 Overview

**Files:**
- Modify: `src/app/[locale]/docs/page.tsx` (append section object to `sections` array)
- Modify: `messages/en.json` (add `docs.sections.overview.*`)
- Modify: `messages/ru.json` (add `docs.sections.overview.*`)

- [ ] **Step 1: Add EN keys.** Inside the `docs.sections` block in `messages/en.json`, add:

```json
"overview": {
  "toc_label": "Overview",
  "title": "Overview",
  "p1": "TubeMine reads a YouTube video's public comments and returns the audience signal: sentiment direction, the words people use most, and the emoji they reach for. Paste a URL and the results are ready in seconds.",
  "p2": "It is for creators, marketing analysts, ML researchers, indie developers, and anyone who wants to read the room without scrolling through hundreds of comments by hand."
}
```

- [ ] **Step 2: Add RU keys.** Inside the `docs.sections` block in `messages/ru.json`, add:

```json
"overview": {
  "toc_label": "Обзор",
  "title": "Обзор",
  "p1": "TubeMine читает публичные комментарии под видео YouTube и возвращает сигнал аудитории: направление сентимента, самые частые слова, самые частые эмодзи. Вставьте URL и получите результат за несколько секунд.",
  "p2": "Подойдёт авторам, маркетинговым аналитикам, ML-исследователям, инди-разработчикам и всем, кому нужно понять реакцию аудитории не прокручивая сотни комментариев вручную."
}
```

- [ ] **Step 3: Append the section to the `sections` array in `docs/page.tsx`.** Inside the `sections` array (currently empty), add:

```tsx
{
  id: "overview",
  num: "01",
  tocLabel: t("sections.overview.toc_label"),
  title: t("sections.overview.title"),
  body: (
    <>
      {/* SRC: README.md "What it does" lines 27-31 */}
      <p>{t("sections.overview.p1")}</p>
      <p>{t("sections.overview.p2")}</p>
    </>
  ),
},
```

---

### Task 3: Add Section 02 Quick start (anonymous flow)

- [ ] **Step 1: Add EN keys.** Append to `docs.sections` in `messages/en.json`:

```json
"quickstart": {
  "toc_label": "Quick start",
  "title": "Quick start (no account needed)",
  "p1": "Anonymous visitors can analyze any public video without signing in.",
  "b1_strong": "1. Paste a public YouTube URL.",
  "b1_text": "The home page form accepts any standard YouTube video URL (shortened, full, or with a timestamp).",
  "b2_strong": "2. Confirm the preview.",
  "b2_text": "TubeMine fetches the video's title, channel, view count, like count, and comment count so you can verify it is the right video before analysis.",
  "b3_strong": "3. Click Analyze and download CSV.",
  "b3_text": "Results render in the browser and a CSV is built client-side with columns author, text, likes, replies, publishedAt.",
  "callout_strong": "Anonymous limit:",
  "callout_text": "1,000 comments per IP per video. Results live in your browser only until you close the tab. Sign in to bump the limit to 5,000 comments per month and save up to 10 analyses to history."
}
```

- [ ] **Step 2: Add RU keys.** Append to `docs.sections` in `messages/ru.json`:

```json
"quickstart": {
  "toc_label": "Быстрый старт",
  "title": "Быстрый старт (аккаунт не нужен)",
  "p1": "Анонимные посетители могут проанализировать любое публичное видео без входа в аккаунт.",
  "b1_strong": "1. Вставьте публичный YouTube URL.",
  "b1_text": "Форма на главной принимает любой стандартный YouTube URL (короткий, полный, с таймкодом).",
  "b2_strong": "2. Подтвердите превью.",
  "b2_text": "TubeMine получает заголовок, канал, число просмотров, лайков и комментариев чтобы вы убедились что выбрали нужное видео.",
  "b3_strong": "3. Нажмите «Анализ» и скачайте CSV.",
  "b3_text": "Результаты отрисовываются в браузере, CSV формируется на стороне клиента со столбцами author, text, likes, replies, publishedAt.",
  "callout_strong": "Анонимный лимит:",
  "callout_text": "1 000 комментариев на один IP на одно видео. Результаты живут в браузере до закрытия вкладки. Войдите чтобы поднять лимит до 5 000 комментариев в месяц и сохранять до 10 анализов в истории."
}
```

> **Note:** The RU "1 000" and "5 000" use U+0020 plain ASCII space (byte `0x20`), matching the shipped `pricing.compare.row_monthly_*` cells. Verify by running `jq -r '.docs.sections.quickstart.callout_text' messages/ru.json | xxd | head -1` after Step 2 and confirm the bytes between digits are `20`.

- [ ] **Step 3: Append section to `sections` array in `docs/page.tsx`.**

```tsx
{
  id: "quickstart",
  num: "02",
  tocLabel: t("sections.quickstart.toc_label"),
  title: t("sections.quickstart.title"),
  body: (
    <>
      {/* SRC: README.md "How it works" steps 1-3 (lines 70-75) + pricing.compare.row_monthly_anon */}
      <p>{t("sections.quickstart.p1")}</p>
      <ul>
        <li>
          <strong>{t("sections.quickstart.b1_strong")}</strong>{" "}
          {t("sections.quickstart.b1_text")}
        </li>
        <li>
          <strong>{t("sections.quickstart.b2_strong")}</strong>{" "}
          {t("sections.quickstart.b2_text")}
        </li>
        <li>
          <strong>{t("sections.quickstart.b3_strong")}</strong>{" "}
          {t("sections.quickstart.b3_text")}
        </li>
      </ul>
      <div className="callout">
        <p>
          <strong>{t("sections.quickstart.callout_strong")}</strong>{" "}
          {t("sections.quickstart.callout_text")}
        </p>
      </div>
    </>
  ),
},
```

---

### Task 4: Add Section 03 Sign in (Free flow)

- [ ] **Step 1: EN keys** (append to `docs.sections` in `messages/en.json`):

```json
"signin": {
  "toc_label": "Sign in (Free)",
  "title": "Sign in for the Free plan",
  "p1": "Sign in with Google to switch from per-IP limits to a per-account monthly budget plus saved history.",
  "b1_strong": "Sign in via Google.",
  "b1_text": "The /login route handles OAuth. No password to remember.",
  "b2_strong": "5,000 comments per month.",
  "b2_text": "Counted across all videos you analyze in the calendar month; resets on the 1st.",
  "b3_strong": "Last 10 analyses saved.",
  "b3_text": "Visit /history to revisit prior runs and re-download their CSV.",
  "b4_strong": "Same CSV format.",
  "b4_text": "Author, text, likes, replies, publishedAt. Same columns as anonymous; just more of them per month."
}
```

- [ ] **Step 2: RU keys** (append to `docs.sections` in `messages/ru.json`):

```json
"signin": {
  "toc_label": "Вход (Free)",
  "title": "Войдите для тарифа Free",
  "p1": "Войдите через Google чтобы перейти с IP-лимита на месячный лимит на аккаунт плюс сохранённую историю.",
  "b1_strong": "Вход через Google.",
  "b1_text": "Маршрут /login обрабатывает OAuth. Пароли запоминать не нужно.",
  "b2_strong": "5 000 комментариев в месяц.",
  "b2_text": "Считается по всем видео которые вы проанализировали в текущем календарном месяце. Сбрасывается 1-го числа.",
  "b3_strong": "Последние 10 анализов сохраняются.",
  "b3_text": "Зайдите в /history чтобы пересмотреть прошлые запуски и заново скачать их CSV.",
  "b4_strong": "Тот же формат CSV.",
  "b4_text": "Author, text, likes, replies, publishedAt. Те же столбцы что и в анонимном режиме, просто больше в месяц."
}
```

- [ ] **Step 3: Append section to array:**

```tsx
{
  id: "signin",
  num: "03",
  tocLabel: t("sections.signin.toc_label"),
  title: t("sections.signin.title"),
  body: (
    <>
      {/* SRC: README plans table Free column + pricing.compare.row_monthly_free + row_saved_free */}
      <p>{t("sections.signin.p1")}</p>
      <ul>
        <li>
          <strong>{t("sections.signin.b1_strong")}</strong>{" "}
          {t("sections.signin.b1_text")}
        </li>
        <li>
          <strong>{t("sections.signin.b2_strong")}</strong>{" "}
          {t("sections.signin.b2_text")}
        </li>
        <li>
          <strong>{t("sections.signin.b3_strong")}</strong>{" "}
          {t("sections.signin.b3_text")}
        </li>
        <li>
          <strong>{t("sections.signin.b4_strong")}</strong>{" "}
          {t("sections.signin.b4_text")}
        </li>
      </ul>
    </>
  ),
},
```

---

### Task 5: Add Section 04 Pro flow

- [ ] **Step 1: EN keys:**

```json
"pro": {
  "toc_label": "Pro flow",
  "title": "Pro flow ($19/month)",
  "p1": "Pro is $19 per month with a 3-day free trial. It adds the data that creators and analysts actually want for digging into the audience: exact sentiment percentages, full word and emoji rankings, JSON and Excel exports, and a much larger monthly budget.",
  "b1_strong": "Price and trial.",
  "b1_text": "Pro costs $19 / month. New signups get a 3-day free trial; you only pay on day 4 if you stay.",
  "b2_strong": "7-day refund window.",
  "b2_text": "After your first charge, you have 7 days to request a refund through the customer portal. The trial and refund windows do not stack: the trial runs before any charge; the refund window starts only once billing begins.",
  "b3_strong": "Cancel anytime.",
  "b3_text": "Pro is month to month, no minimum term. Cancel from the customer portal in two clicks.",
  "b4_strong": "100,000 comments per month, 100 saved analyses, exact sentiment plus trends.",
  "b4_text": "JSON and Excel exports available from /dashboard and /history.",
  "p2_prefix": "Full comparison and FAQ at",
  "p2_link_pricing": "/pricing",
  "p2_tail": "."
}
```

- [ ] **Step 2: RU keys:**

```json
"pro": {
  "toc_label": "Тариф Pro",
  "title": "Тариф Pro ($19/month)",
  "p1": "Pro стоит $19 в месяц с 3-дневным бесплатным trial. Добавляет данные которые нужны авторам и аналитикам для глубокого анализа аудитории: точные проценты сентимента, полные рейтинги слов и эмодзи, экспорт в JSON и Excel, и существенно больший месячный лимит.",
  "b1_strong": "Цена и trial.",
  "b1_text": "Pro стоит $19 / month. Новые подписки получают 3-дневный бесплатный trial; первое списание происходит только на 4-й день если вы продолжаете.",
  "b2_strong": "7 дней на возврат.",
  "b2_text": "После первого списания у вас есть 7 дней чтобы запросить возврат через customer portal. Trial и окно возврата не суммируются: trial идёт до любого списания, окно возврата стартует только когда начинается биллинг.",
  "b3_strong": "Отмена в любой момент.",
  "b3_text": "Pro работает помесячно, без минимального срока. Отмена через customer portal в два клика.",
  "b4_strong": "100 000 комментариев в месяц, 100 сохранённых анализов, точные проценты сентимента и тренды.",
  "b4_text": "JSON и Excel экспорт доступны с /dashboard и /history.",
  "p2_prefix": "Полное сравнение и FAQ на",
  "p2_link_pricing": "/pricing",
  "p2_tail": "."
}
```

- [ ] **Step 3: Append section to array:**

```tsx
{
  id: "pro",
  num: "04",
  tocLabel: t("sections.pro.toc_label"),
  title: t("sections.pro.title"),
  body: (
    <>
      {/* SRC: README plans Pro column + pricing.pro.price/unit + pricing.faq.a5 */}
      <p>{t("sections.pro.p1")}</p>
      <ul>
        <li>
          <strong>{t("sections.pro.b1_strong")}</strong>{" "}
          {t("sections.pro.b1_text")}
        </li>
        <li>
          <strong>{t("sections.pro.b2_strong")}</strong>{" "}
          {t("sections.pro.b2_text")}
        </li>
        <li>
          <strong>{t("sections.pro.b3_strong")}</strong>{" "}
          {t("sections.pro.b3_text")}
        </li>
        <li>
          <strong>{t("sections.pro.b4_strong")}</strong>{" "}
          {t("sections.pro.b4_text")}
        </li>
      </ul>
      <p>
        {t("sections.pro.p2_prefix")}{" "}
        <IntlLink href="/pricing#faq">
          {t("sections.pro.p2_link_pricing")}
        </IntlLink>
        {t("sections.pro.p2_tail")}
      </p>
    </>
  ),
},
```

---

### Task 6: Add Section 05 Output formats (CSV, JSON, Excel)

- [ ] **Step 1: EN keys:**

```json
"formats": {
  "toc_label": "Output formats",
  "title": "Output formats (CSV, JSON, Excel)",
  "p1": "Three formats are available, by tier.",
  "csv_strong": "CSV (all tiers).",
  "csv_text": "Columns: author, text, likes, replies, publishedAt. Generated client-side via Papa Parse. Cells starting with =, +, -, @ are sanitized to prevent formula injection when you open the file in Excel or Sheets.",
  "json_strong": "JSON (Pro).",
  "json_text": "Same record schema as CSV plus the analysis aggregates: sentiment percentages, top words, top emoji. Downloaded from /dashboard or /history. The 'API coming soon' qualifier on the pricing page refers to a planned public REST API for developers; the JSON file download itself works today.",
  "xlsx_strong": "Excel / XLSX (Pro).",
  "xlsx_text": "Generated server-side. Same data as JSON. Same formula-injection sanitization as CSV.",
  "p2_security": "Formula-injection sanitization (shipped 2026-05-21) covers ASCII =, +, -, @ plus their full-width Unicode variants. OWASP-recommended hardening for any user-generated content exported to spreadsheets."
}
```

- [ ] **Step 2: RU keys:**

```json
"formats": {
  "toc_label": "Форматы экспорта",
  "title": "Форматы экспорта (CSV, JSON, Excel)",
  "p1": "Доступны три формата, по тарифам.",
  "csv_strong": "CSV (все тарифы).",
  "csv_text": "Столбцы: author, text, likes, replies, publishedAt. Формируется на стороне клиента через Papa Parse. Ячейки начинающиеся с =, +, -, @ санитайзятся, чтобы не сработала formula injection при открытии файла в Excel или Sheets.",
  "json_strong": "JSON (Pro).",
  "json_text": "Та же структура записей что в CSV плюс агрегаты анализа: проценты сентимента, топ слов, топ эмодзи. Скачивается с /dashboard или /history. Пометка «API coming soon» на странице цен относится к планируемому публичному REST API для разработчиков; сам JSON-экспорт работает уже сейчас.",
  "xlsx_strong": "Excel / XLSX (Pro).",
  "xlsx_text": "Формируется на сервере. Те же данные что и JSON. Та же защита от formula injection что и для CSV.",
  "p2_security": "Защита от formula injection (shipped 2026-05-21) покрывает ASCII =, +, -, @ и их full-width Unicode варианты. Hardening рекомендованный OWASP для любого пользовательского контента который экспортируется в таблицы."
}
```

- [ ] **Step 3: Append section to array:**

```tsx
{
  id: "formats",
  num: "05",
  tocLabel: t("sections.formats.toc_label"),
  title: t("sections.formats.title"),
  body: (
    <>
      {/* SRC: README "How it works" step 3 lines 73-74 + TUB-23 sanitization */}
      <p>{t("sections.formats.p1")}</p>
      <ul>
        <li>
          <strong>{t("sections.formats.csv_strong")}</strong>{" "}
          {t("sections.formats.csv_text")}
        </li>
        <li>
          <strong>{t("sections.formats.json_strong")}</strong>{" "}
          {t("sections.formats.json_text")}
        </li>
        <li>
          <strong>{t("sections.formats.xlsx_strong")}</strong>{" "}
          {t("sections.formats.xlsx_text")}
        </li>
      </ul>
      <p>{t("sections.formats.p2_security")}</p>
    </>
  ),
},
```

---

### Task 7: Add Section 06 Limits and quotas

- [ ] **Step 1: EN keys:**

```json
"limits": {
  "toc_label": "Limits and quotas",
  "title": "Limits and quotas",
  "p1": "Quotas are tracked separately per tier.",
  "ip_strong": "Anonymous (per IP).",
  "ip_text": "1,000 comments per IP per video. Monthly per-IP budget resets on the 1st of the next calendar month.",
  "user_strong": "Free and Pro (per account).",
  "user_text": "Budget tied to your Google sign-in: 5,000 / month for Free, 100,000 / month for Pro. Resets on the 1st. Current usage and reset date visible at /profile.",
  "yt_strong": "YouTube API quota.",
  "yt_text": "TubeMine uses its own shared quota with the YouTube Data API v3, so you never need your own API key. If our shared quota is exhausted for the day you may see the message 'TubeMine has hit its YouTube API daily quota'; the quota refreshes daily on YouTube's schedule."
}
```

- [ ] **Step 2: RU keys:**

```json
"limits": {
  "toc_label": "Лимиты и квоты",
  "title": "Лимиты и квоты",
  "p1": "Лимиты считаются отдельно для каждого тарифа.",
  "ip_strong": "Анонимный (по IP).",
  "ip_text": "1 000 комментариев на один IP на одно видео. Месячный лимит на IP сбрасывается 1-го числа следующего календарного месяца.",
  "user_strong": "Free и Pro (по аккаунту).",
  "user_text": "Лимит привязан к вашему Google-аккаунту: 5 000 / month для Free, 100 000 / month для Pro. Сбрасывается 1-го числа. Текущее использование и дата сброса видны на /profile.",
  "yt_strong": "Квота YouTube API.",
  "yt_text": "TubeMine использует собственную общую квоту YouTube Data API v3, ваш собственный API key не нужен. Если общая квота исчерпана на день, вы можете увидеть сообщение «TubeMine has hit its YouTube API daily quota»; квота обновляется ежедневно по расписанию YouTube."
}
```

- [ ] **Step 3: Append section to array:**

```tsx
{
  id: "limits",
  num: "06",
  tocLabel: t("sections.limits.toc_label"),
  title: t("sections.limits.title"),
  body: (
    <>
      {/* SRC: README "Quota enforcement" line 75 + comparison row_monthly_* */}
      <p>{t("sections.limits.p1")}</p>
      <ul>
        <li>
          <strong>{t("sections.limits.ip_strong")}</strong>{" "}
          {t("sections.limits.ip_text")}
        </li>
        <li>
          <strong>{t("sections.limits.user_strong")}</strong>{" "}
          {t("sections.limits.user_text")}
        </li>
        <li>
          <strong>{t("sections.limits.yt_strong")}</strong>{" "}
          {t("sections.limits.yt_text")}
        </li>
      </ul>
    </>
  ),
},
```

---

### Task 8: Add Section 07 Troubleshooting

Per spec § 4.7.1: `err*_q` values stay byte-equal English in `messages/ru.json`. Only surrounding prose (`err*_a`, `p1`, `p_contact_*`) is translated.

- [ ] **Step 1: EN keys:**

```json
"troubleshoot": {
  "toc_label": "Troubleshooting",
  "title": "Troubleshooting common errors",
  "p1": "If extract or preview fails, here is how to read the most common error messages.",
  "err1_q": "\"Video not found\"",
  "err1_a": "The URL is invalid, or the video is private or has been removed. Verify the URL by opening it in a YouTube tab; TubeMine only works with public videos.",
  "err2_q": "\"Comments are disabled for this video by the uploader\"",
  "err2_a": "The video's uploader has turned off comments on YouTube itself; there is no comment thread to analyze.",
  "err3_q": "\"TubeMine has hit its YouTube API daily quota. Please try again tomorrow.\"",
  "err3_a": "Our shared YouTube Data API quota for the day is exhausted. It refreshes daily on YouTube's schedule; try again the next day.",
  "err4_q": "\"Monthly Pro cap reached. Resets on the 1st.\" / \"Free tier cap reached. Upgrade for 100,000 comments/month.\"",
  "err4_a": "Your account has hit its monthly cap (5,000 for Free, 100,000 for Pro). The quota resets on the 1st of the next calendar month. Current usage and reset date are visible at /profile.",
  "err5_q": "\"Monthly budget exhausted\"",
  "err5_a": "Anonymous-visitor monthly per-IP cap. Sign in with Google to switch to a per-account budget (5,000 Free, 100,000 Pro).",
  "p_contact_prefix": "If none of these match what you see, email",
  "p_contact_link": "hello@tubemine.app",
  "p_contact_tail": "."
}
```

- [ ] **Step 2: RU keys** (quoted English strings preserved verbatim per § 4.7.1):

```json
"troubleshoot": {
  "toc_label": "Troubleshooting",
  "title": "Частые ошибки",
  "p1": "Если extract или preview падает, вот как читать самые частые сообщения об ошибке.",
  "err1_q": "\"Video not found\"",
  "err1_a": "URL некорректный или видео приватное / удалено. Откройте URL в новой вкладке YouTube чтобы проверить; TubeMine работает только с публичными видео.",
  "err2_q": "\"Comments are disabled for this video by the uploader\"",
  "err2_a": "Автор видео отключил комментарии на стороне YouTube; нет ветки комментариев чтобы её анализировать.",
  "err3_q": "\"TubeMine has hit its YouTube API daily quota. Please try again tomorrow.\"",
  "err3_a": "Наша общая квота YouTube Data API на день исчерпана. Обновляется ежедневно по расписанию YouTube; попробуйте на следующий день.",
  "err4_q": "\"Monthly Pro cap reached. Resets on the 1st.\" / \"Free tier cap reached. Upgrade for 100,000 comments/month.\"",
  "err4_a": "Ваш аккаунт достиг месячного лимита (5 000 для Free, 100 000 для Pro). Квота сбрасывается 1-го числа следующего календарного месяца. Текущее использование и дата сброса видны на /profile.",
  "err5_q": "\"Monthly budget exhausted\"",
  "err5_a": "Месячный лимит для анонимных посетителей на один IP. Войдите через Google чтобы перейти на лимит по аккаунту (5 000 Free, 100 000 Pro).",
  "p_contact_prefix": "Если ничего из перечисленного не соответствует тому что вы видите, напишите на",
  "p_contact_link": "hello@tubemine.app",
  "p_contact_tail": "."
}
```

- [ ] **Step 3: Append section to array:**

```tsx
{
  id: "troubleshoot",
  num: "07",
  tocLabel: t("sections.troubleshoot.toc_label"),
  title: t("sections.troubleshoot.title"),
  body: (
    <>
      {/* SRC: src/app/api/extract/route.ts:114-145, 203-213 + preview/route.ts:39 */}
      <p>{t("sections.troubleshoot.p1")}</p>
      <ul>
        <li>
          <strong>{t("sections.troubleshoot.err1_q")}</strong>{" "}
          {t("sections.troubleshoot.err1_a")}
        </li>
        <li>
          <strong>{t("sections.troubleshoot.err2_q")}</strong>{" "}
          {t("sections.troubleshoot.err2_a")}
        </li>
        <li>
          <strong>{t("sections.troubleshoot.err3_q")}</strong>{" "}
          {t("sections.troubleshoot.err3_a")}
        </li>
        <li>
          <strong>{t("sections.troubleshoot.err4_q")}</strong>{" "}
          {t("sections.troubleshoot.err4_a")}
        </li>
        <li>
          <strong>{t("sections.troubleshoot.err5_q")}</strong>{" "}
          {t("sections.troubleshoot.err5_a")}
        </li>
      </ul>
      <p>
        {t("sections.troubleshoot.p_contact_prefix")}{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>
          {t("sections.troubleshoot.p_contact_link")}
        </a>
        {t("sections.troubleshoot.p_contact_tail")}
      </p>
    </>
  ),
},
```

---

### Task 9: Add Section 08 Open source

- [ ] **Step 1: EN keys:**

```json
"opensource": {
  "toc_label": "Open source",
  "title": "Open source (MIT)",
  "p1_prefix": "TubeMine is open source under the MIT license. The full repository is on",
  "p1_link_github": "GitHub",
  "p1_tail": ".",
  "p2": "Contributions are welcome: fork the repo, create a feature branch, open a pull request against main with a clear description. See the README Contributing section for the local dev setup."
}
```

- [ ] **Step 2: RU keys:**

```json
"opensource": {
  "toc_label": "Open source",
  "title": "Open source (MIT)",
  "p1_prefix": "TubeMine, это open source под MIT-лицензией. Репозиторий целиком на",
  "p1_link_github": "GitHub",
  "p1_tail": ".",
  "p2": "Контрибьюции приветствуются: форкните репозиторий, создайте feature-ветку, откройте pull request в main с понятным описанием. Локальная настройка описана в разделе Contributing в README."
}
```

- [ ] **Step 3: Append section to array:**

```tsx
{
  id: "opensource",
  num: "08",
  tocLabel: t("sections.opensource.toc_label"),
  title: t("sections.opensource.title"),
  body: (
    <>
      {/* SRC: README Contributing + License sections lines 162-173 */}
      <p>
        {t("sections.opensource.p1_prefix")}{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          {t("sections.opensource.p1_link_github")}
        </a>
        {t("sections.opensource.p1_tail")}
      </p>
      <p>{t("sections.opensource.p2")}</p>
    </>
  ),
},
```

---

### Task 10: Local smoke test PR 1

- [ ] **Step 1: Em-dash diff grep.** Run:

```bash
git diff --staged -- src/app/\[locale\]/docs/ messages/en.json messages/ru.json \
  | grep -nP '^\+.*[\x{2014}\x{2013}]'
```

Expected: exit code 1 (no matches). If output appears, find and replace the em-dash / en-dash before continuing.

- [ ] **Step 2: ICU placeholder grep on new keys.** Run:

```bash
jq -r '.docs | tostring' messages/en.json | grep -oE '\{[^}]+\}' || true
jq -r '.docs | tostring' messages/ru.json | grep -oE '\{[^}]+\}' || true
```

Expected: no output (no ICU tokens were planned for docs keys). If output appears, an unintended `{token}` slipped in.

- [ ] **Step 3: TypeScript check.** Run `pnpm tsc --noEmit`. Expected: zero errors.

- [ ] **Step 4: Lint.** Run `pnpm lint`. Expected: zero new warnings.

- [ ] **Step 5: Visual smoke (skip if running headless).** Run `pnpm dev` in background, open `http://localhost:3000/en/docs` and `http://localhost:3000/ru/docs` in browser. Confirm: 8 numbered sections render, TOC sticky on desktop, no raw `{token}` visible. Stop the dev server.

- [ ] **Step 6: RU number byte check.** Run:

```bash
jq -r '.docs.sections.quickstart.callout_text' messages/ru.json | grep -oE '[0-9]+ [0-9]+' | head -3
jq -r '.docs.sections.limits.ip_text' messages/ru.json | head -1 | xxd | head -1
```

Verify the digit-space-digit groups use byte `0x20` (plain ASCII space).

---

### Task 11: Commit PR 1

- [ ] **Step 1: Stage all PR 1 changes.**

```bash
git add src/app/\[locale\]/docs/page.tsx messages/en.json messages/ru.json
```

- [ ] **Step 2: Commit.**

```bash
git commit -m "$(cat <<'EOF'
feat(docs): ship /docs page with 8 sections (TUB-31)

Replaces the 19-line stub at src/app/[locale]/docs/page.tsx with a
production-grade bilingual content page reusing the .legal-page CSS
scope already shipped on /privacy and /terms.

Sections (8): Overview, Quick start (anonymous), Sign in (Free),
Pro flow, Output formats (CSV/JSON/Excel), Limits and quotas,
Troubleshooting (5 verbatim API error strings), Open source.

Every claim traces to README, pricing keys, or codebase strings per
the anti-fabrication contract in the spec. No em-dash anywhere. RU
number formatting matches the shipped pricing.compare.* convention
(ASCII space U+0020). Quoted English error strings stay byte-equal
to API output in RU body per spec section 4.7.1.

Spec: docs/superpowers/specs/2026-05-21-tub-30-docs-changelog-content-design.md
Plan: docs/superpowers/plans/2026-05-21-tub-31-docs-changelog-content.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push to origin/main.**

```bash
git push origin main
```

---

### Task 12: Verify-on-prod gate PR 1

- [ ] **Step 1: Wait for Vercel READY.** Capture the just-pushed SHA via `git rev-parse HEAD`. Poll `mcp__vercel__list_deployments` (filter `target: "production"`, find the entry whose `meta.githubCommitSha` matches the pushed SHA) every 10 seconds until `readyState === "READY"`. Budget: 600 seconds. If not READY after 600s, abort the gate and check the Vercel dashboard.

- [ ] **Step 2: Navigate Chrome MCP to both URLs.**

```
mcp__chrome-devtools__navigate_page url=https://tubemine.tech/en/docs
mcp__chrome-devtools__take_snapshot
mcp__chrome-devtools__navigate_page url=https://tubemine.tech/ru/docs
mcp__chrome-devtools__take_snapshot
```

If a Chrome MCP call fails transiently, retry up to 3 times with 30s backoff. On persistent failure, fall back to `curl -s https://tubemine.tech/en/docs | grep -c '<section'` to confirm the page renders.

- [ ] **Step 3: DOM em-dash assertion (per locale).** Via `mcp__chrome-devtools__evaluate_script` (or browser console):

```js
Array.from(document.querySelector('article.legal-article').textContent)
  .filter(c => c.charCodeAt(0) === 0x2014 || c.charCodeAt(0) === 0x2013)
  .length
```

Expected: `0` on both `/en/docs` and `/ru/docs`.

- [ ] **Step 4: DOM ICU token assertion (per locale).**

```js
(document.querySelector('article.legal-article').textContent.match(/\{[^}]+\}/g) || []).length
```

Expected: `0` on both locales.

- [ ] **Step 5: Section count assertion.**

```js
document.querySelectorAll('article.legal-article > section').length
```

Expected: `8` on both locales.

- [ ] **Step 6: Footer link smoke test.** Navigate to `https://tubemine.tech/en` and click the Docs link in the footer. Confirm it lands on `/en/docs`. Repeat for `/ru/pricing` -> footer Docs link -> `/ru/docs`.

- [ ] **Step 7: Screenshots.** Take screenshots at 1280x800 desktop and 375x812 mobile for both locales (4 screenshots total). Save to `~/vault/projects/yt-comments/sessions/2026-05-21/tub-31-docs-changelog/screenshots/pr1-{en,ru}-{desktop,mobile}.png`. If `mkdir -p` is needed for the vault path, run it first.

- [ ] **Step 8: PR 1 gate decision.** If ALL of Steps 3-7 pass, PR 1 is green; proceed to PR 2 (Task 13). If ANY step fails, apply hotfix-forward per spec § 10.4: open a single hotfix commit, push, re-run Task 12 from Step 1. Do NOT use `git revert`.

---

## PR 2: Changelog page

Single commit on `main` after Task 12 PR 1 gate passes.

### Task 13: Scaffold changelog page with RU banner and lang="en" article

**Files:**
- Modify: `src/app/[locale]/changelog/page.tsx` (replace 23-line stub)
- Modify: `messages/en.json` (add `changelog.*` chrome keys)
- Modify: `messages/ru.json` (add `changelog.*` chrome keys)

- [ ] **Step 1: Replace the stub.** Open `src/app/[locale]/changelog/page.tsx` and replace with:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link as IntlLink } from "@/i18n/navigation"
import { LegalToc } from "@/components/legal-toc"

const REPO_URL = "https://github.com/RakhimovY/tubemine"
const SUPPORT_EMAIL = "hello@tubemine.app"
const LAST_UPDATED = "May 21, 2026"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "changelog.meta" })
  return {
    title: t("title"),
    description: t("description"),
  }
}

/*
  TUB-31 Changelog content sprint (page 2 of 2).
  Body is English-only (per existing legal_disclaimer_ru_changelog design).
  Chrome (hero, TOC, footer) is bilingual. Article wrapper carries
  lang="en" dir="ltr" so screen readers on /ru/changelog pronounce
  release notes with English phonetics.
  Reuses the .legal-page CSS scope from /privacy + /terms.
*/
export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("changelog")
  const tLanding = await getTranslations("landing")
  const tRoot = await getTranslations()

  const releases = [
    // Release entries appended by Task 14.
  ]

  return (
    <div className="legal-page">
      <LegalToc />

      {locale === "ru" ? (
        <div
          role="note"
          className="not-prose mb-6 rounded border-l-4 border-yellow-500 bg-yellow-50 p-4 text-sm dark:bg-yellow-950/30"
        >
          {tRoot("legal_disclaimer_ru_changelog")}
        </div>
      ) : null}

      <main>
        <section className="legal-hero">
          <div className="container">
            <span className="legal-badge">{t("hero.badge")}</span>
            <h1 className="legal-title">{t("hero.title")}</h1>
            <p className="legal-sub">{t("hero.sub")}</p>
            <p className="legal-updated">
              {t("hero.updated_label")}: {LAST_UPDATED}
            </p>
          </div>
        </section>

        <section className="legal-body">
          <div className="container legal-grid">
            <aside className="toc" aria-label={t("toc.aria")}>
              <h3>{t("toc.heading")}</h3>
              <ol>
                {releases.map((r) => (
                  <li key={r.id}>
                    <a href={`#${r.id}`}>{r.date}</a>
                  </li>
                ))}
              </ol>
            </aside>

            <article className="legal-article" lang="en" dir="ltr">
              {releases.map((r) => (
                <section key={r.id} id={r.id}>
                  <h2>
                    <span className="num">{r.num}</span> {r.date}
                  </h2>
                  {r.body}
                </section>
              ))}
            </article>
          </div>
        </section>
      </main>

      <ChangelogFooter tLanding={tLanding} />
    </div>
  )
}

function ChangelogFooter({
  tLanding,
}: {
  tLanding: Awaited<ReturnType<typeof getTranslations<"landing">>>
}) {
  // VERBATIM copy of the LegalFooter function in src/app/[locale]/terms/page.tsx
  // including the full SOCIALS array. Same pattern as DocsFooter from PR 1.
  return null // PLACEHOLDER - replaced by Task 13 Step 2.
}

const SOCIALS: Array<{ label: string; url: string; icon: React.ReactNode }> = []
```

- [ ] **Step 2: Copy verbatim footer + SOCIALS.** Same as Task 1 Step 2: copy `LegalFooter` body + `SOCIALS` array from `src/app/[locale]/terms/page.tsx` lines 238-420, paste in place of `ChangelogFooter` placeholder + empty SOCIALS. Rename the function to `ChangelogFooter`.

- [ ] **Step 3: Add EN chrome keys to `messages/en.json`.** Locate alphabetically (between `"auth"` and `"common"`). Add:

```json
"changelog": {
  "meta": {
    "title": "Changelog | TubeMine",
    "description": "Public release notes for TubeMine."
  },
  "hero": {
    "badge": "Changelog",
    "title": "What changed.",
    "sub": "User-impact release notes, grouped by date. Newest first.",
    "updated_label": "Last updated"
  },
  "toc": {
    "aria": "Releases",
    "heading": "Releases"
  }
},
```

- [ ] **Step 4: Add RU chrome keys to `messages/ru.json`** (same alphabetical position):

```json
"changelog": {
  "meta": {
    "title": "Что нового | TubeMine",
    "description": "Публичный журнал релизов TubeMine."
  },
  "hero": {
    "badge": "Что нового",
    "title": "Что изменилось.",
    "sub": "Релизные заметки в формате влияния на пользователя, сгруппированы по дате. Сначала новые.",
    "updated_label": "Обновлено"
  },
  "toc": {
    "aria": "Релизы",
    "heading": "Релизы"
  }
},
```

- [ ] **Step 5: Typecheck.** Run `pnpm tsc --noEmit`. Expected: zero errors.

---

### Task 14: Add 5 release sections (EN body)

Per spec § 5.2: body is EN-only with Keep-a-Changelog subsections (Added / Changed / Fixed / Security). No new i18n keys.

- [ ] **Step 1: Replace the empty `releases` array** in `src/app/[locale]/changelog/page.tsx` with the full 5-release array. The array is inserted between `const releases = [` and `]` (replacing the comment line):

```tsx
const releases = [
  {
    id: "r-2026-05-21",
    num: "01",
    date: "2026-05-21",
    body: (
      <>
        {/* SRC: TUB-8, TUB-11 hotfixes, TUB-12, TUB-13 milestones, TUB-16..27. Commits: ee9fc16 7e172e0 f7f288e 4b3fbe5 fefeb02 55b0460 552e7cc f5a89b3 ffe3ff2 2d21bc0 21091b7 59cd134 5eb799d 856dfce ab2e3e8 c8d00d4 cdc17c3 ddcb2a6 5e7aac9 */}
        <h3>Added</h3>
        <ul>
          <li>
            Inbound email forwarding so <code>support@tubemine.tech</code> now reaches
            the inbox (TUB-8).
          </li>
          <li>
            Shared signed-in app shell layout. No more flicker switching between
            Dashboard, History, and Profile (TUB-13).
          </li>
          <li>
            Russian and English localization across the export bar, analytics,
            extractor, and skeleton loading states (TUB-13).
          </li>
        </ul>
        <h3>Changed</h3>
        <ul>
          <li>
            GitHub README rewritten with new screenshots and the production URL
            migrated to <code>tubemine.tech</code> (TUB-12).
          </li>
          <li>
            Header swaps the "Features" link for "Dashboard" when you are signed in.
          </li>
        </ul>
        <h3>Fixed</h3>
        <ul>
          <li>
            Pro sentiment label now localizes correctly in Russian (TUB-21).
          </li>
          <li>
            Profile plan card no longer shows the raw{" "}
            <code>{"{cap, number}"}</code> ICU placeholder (TUB-17).
          </li>
          <li>
            Dashboard cards now have proper spacing between sections (TUB-19).
          </li>
          <li>
            Topbar breadcrumb now updates when navigating between Dashboard,
            History, and Profile (TUB-18).
          </li>
          <li>
            Recent Analyses and History rows now persist real video title,
            channel name, and thumbnail instead of placeholders (TUB-20).
          </li>
          <li>
            Russian profile no longer doubles the word "использовано" (TUB-22).
          </li>
          <li>
            Extract and "Try another URL" buttons match the design system
            instead of low-contrast shadcn primitives (TUB-25).
          </li>
          <li>
            Dashboard quota indicator no longer renders three times on the same
            page for Pro users (TUB-26).
          </li>
          <li>
            Quick Analyze preview thumbnail now respects the 180px width cap
            (TUB-27).
          </li>
        </ul>
        <h3>Security</h3>
        <ul>
          <li>
            CSV and XLSX exports now sanitize formula-injection vectors (
            <code>=</code> <code>+</code> <code>-</code> <code>@</code> plus
            full-width Unicode variants) per OWASP guidance. Affects every
            export across Anonymous, Free, and Pro tiers (TUB-23, P0).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "r-2026-05-20",
    num: "02",
    date: "2026-05-20",
    body: (
      <>
        {/* SRC: TUB-1 (visual port 9 pages), TUB-11 Phase 1 branding, TUB-7. Commits: 534e15f..80b0a21, 5e7aac9 */}
        <h3>Added</h3>
        <ul>
          <li>
            Full v3 visual redesign across landing, pricing, dashboard,
            profile, history, login, OAuth intro, privacy, and terms (TUB-1,
            9 pages).
          </li>
          <li>
            TubeMine logo, favicon, PWA icons, and OpenGraph image (TUB-11).
          </li>
        </ul>
        <h3>Changed</h3>
        <ul>
          <li>
            Pricing FAQ rewritten to clarify how the 3-day trial and 7-day
            refund window interact (TUB-7).
          </li>
        </ul>
        <h3>Fixed</h3>
        <ul>
          <li>
            Privacy and Terms bullet text no longer wraps per-word on narrow
            viewports.
          </li>
          <li>
            OAuth redirect now hard-pins to <code>NEXT_PUBLIC_ORIGIN</code> (no
            more accidental localhost redirects from production).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "r-2026-05-19",
    num: "03",
    date: "2026-05-19",
    body: (
      <>
        {/* SRC: Phase H + Phase J. Commits: 32423b5 f381746 860e277 73d68b3 030147d 6eacfe3 165b759 6f46952 */}
        <h3>Added</h3>
        <ul>
          <li>3-day free Pro trial. No card charged until day 4.</li>
          <li>
            Tier-aware Recent Analyses rows on the dashboard: qualitative
            label for Free, exact percentages for Pro.
          </li>
          <li>JSON and Excel exports for Pro.</li>
          <li>
            History retention increased from 10 to 100 entries for Pro.
          </li>
          <li>Russian sentiment labels (positive, neutral, negative).</li>
          <li>
            Google OAuth profile metadata (email, name, avatar) copied into the
            profile record.
          </li>
        </ul>
        <h3>Changed</h3>
        <ul>
          <li>
            Landing hero now shows only for anonymous visitors. Signed-in
            visitors land directly on the dashboard.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "r-2026-05-17",
    num: "04",
    date: "2026-05-17",
    body: (
      <>
        {/* SRC: Phase 1.5 + Phase 2. Commits: 217b793 93644e0 */}
        <h3>Added</h3>
        <ul>
          <li>
            Sentiment analysis on every comment (positive, neutral, negative
            direction).
          </li>
          <li>Top words and emoji frequency rankings.</li>
          <li>CSV download for Anonymous and Free tiers with quota gating.</li>
          <li>Google OAuth sign-in.</li>
          <li>Pricing page with Free vs Pro comparison.</li>
        </ul>
      </>
    ),
  },
  {
    id: "r-2026-05-15",
    num: "05",
    date: "2026-05-15",
    body: (
      <>
        {/* SRC: initial scaffold. Commits: 9e91f3a 7957565 2860ebb 1a182d9 6e47459 */}
        <h3>Added</h3>
        <ul>
          <li>First public release (Phase 0).</li>
          <li>
            YouTube URL preview shows title, channel, view, like, and comment
            counts.
          </li>
          <li>
            Anonymous comment analysis with monthly per-IP budget enforced via
            Vercel KV.
          </li>
          <li>CSV download client-side via Papa Parse.</li>
          <li>MIT license.</li>
        </ul>
      </>
    ),
  },
]
```

- [ ] **Step 2: Typecheck.** Run `pnpm tsc --noEmit`. Expected: zero errors.

---

### Task 15: Local smoke test PR 2

- [ ] **Step 1: Em-dash diff grep.**

```bash
git diff --staged -- src/app/\[locale\]/changelog/ messages/en.json messages/ru.json \
  | grep -nP '^\+.*[\x{2014}\x{2013}]'
```

Expected: exit code 1 (no matches).

- [ ] **Step 2: TypeScript check.** Run `pnpm tsc --noEmit`. Expected: zero errors.

- [ ] **Step 3: Lint.** Run `pnpm lint`. Expected: zero new warnings.

- [ ] **Step 4: Visual smoke.** Run `pnpm dev` background, open `http://localhost:3000/en/changelog` and `http://localhost:3000/ru/changelog`. Confirm: 5 release sections, RU page shows yellow banner above hero, EN page does NOT show banner, both pages have lang="en" on `article.legal-article` (verify via DevTools Elements panel).

---

### Task 16: Commit PR 2

- [ ] **Step 1: Stage all PR 2 changes.**

```bash
git add src/app/\[locale\]/changelog/page.tsx messages/en.json messages/ru.json
```

- [ ] **Step 2: Commit.**

```bash
git commit -m "$(cat <<'EOF'
feat(changelog): ship /changelog page with 5 release sections (TUB-31)

Replaces the 23-line stub at src/app/[locale]/changelog/page.tsx
with a production-grade public changelog reusing the .legal-page
CSS scope. Body is EN-only (per existing legal_disclaimer_ru_changelog
design); chrome (hero, TOC) is bilingual. The article wrapper carries
lang="en" dir="ltr" so screen readers on /ru/changelog pronounce
release notes with English phonetics; the RU disclaimer banner above
the hero carries role="note" so RU users hear it explicitly.

5 release sections in Keep-a-Changelog format (Added / Changed /
Fixed / Security), newest first: 2026-05-21 (TUB-8 + TUB-12 + TUB-13
+ 12 QA fixes + TUB-23 P0 security), 2026-05-20 (TUB-1 visual port +
TUB-11 branding + TUB-7), 2026-05-19 (Phase H + Phase J), 2026-05-17
(Phase 1.5 + Phase 2), 2026-05-15 (Phase 0 launch).

Every release entry uses user-impact framing (not commit messages)
and traces to verifiable Linear IDs + git SHAs (inline SRC comments).
No em-dash anywhere.

Spec: docs/superpowers/specs/2026-05-21-tub-30-docs-changelog-content-design.md
Plan: docs/superpowers/plans/2026-05-21-tub-31-docs-changelog-content.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push.**

```bash
git push origin main
```

---

### Task 17: Verify-on-prod gate PR 2

Same protocol as Task 12, applied to `/en/changelog` and `/ru/changelog`.

- [ ] **Step 1: Wait for Vercel READY.** Same as Task 12 Step 1 with the new commit SHA.

- [ ] **Step 2: Navigate Chrome MCP to both URLs.**

```
mcp__chrome-devtools__navigate_page url=https://tubemine.tech/en/changelog
mcp__chrome-devtools__take_snapshot
mcp__chrome-devtools__navigate_page url=https://tubemine.tech/ru/changelog
mcp__chrome-devtools__take_snapshot
```

- [ ] **Step 3: DOM em-dash assertion (per locale).**

```js
Array.from(document.querySelector('article.legal-article').textContent)
  .filter(c => c.charCodeAt(0) === 0x2014 || c.charCodeAt(0) === 0x2013)
  .length
```

Expected: `0` on both URLs.

- [ ] **Step 4: ICU token assertion.**

```js
(document.querySelector('article.legal-article').textContent.match(/\{[^}]+\}/g) || []).length
```

Expected: `0` on both URLs. (Note: the `{cap, number}` reference inside TUB-17 changelog bullet is rendered inside `<code>` tags but the textContent regex above would match it. Adjust assertion to exclude the documented placeholder: `... .filter(m => m !== "{cap, number}").length` should be 0.)

- [ ] **Step 5: Release section count assertion.**

```js
document.querySelectorAll('article.legal-article > section').length
```

Expected: `5` on both URLs.

- [ ] **Step 6: RU disclaimer banner assertion.**

```js
// On /ru/changelog
document.querySelector('[role="note"]') !== null
// Expected: true on /ru/changelog
// Expected: false (null) on /en/changelog
```

- [ ] **Step 7: Article lang attribute assertion (both locales).**

```js
document.querySelector('article.legal-article').getAttribute('lang')
// Expected: "en" on both /en/changelog and /ru/changelog
```

- [ ] **Step 8: Footer link smoke test.** Click footer Changelog link from `/en` and `/ru/pricing`. Confirms navigation.

- [ ] **Step 9: Screenshots.** 4 screenshots (1280x800 + 375x812 x 2 locales) saved to `~/vault/projects/yt-comments/sessions/2026-05-21/tub-31-docs-changelog/screenshots/pr2-{en,ru}-{desktop,mobile}.png`.

- [ ] **Step 10: PR 2 gate decision.** If ALL of Steps 3-9 pass, PR 2 is green; proceed to wrap-up. If ANY fails, hotfix-forward per spec § 10.4. For structural JSX failures (missing `role="note"` or `lang="en"`), the hotfix touches the shared page component and re-deploys both locales.

---

## Wrap-up

### Task 18: Close TUB-31 in Linear

- [ ] **Step 1: Move TUB-31 to Done with a comment listing both commit SHAs.**

```
mcp__claude_ai_Linear__save_issue id=TUB-31 state=Done
mcp__claude_ai_Linear__save_comment issue=TUB-31 body="
Sprint complete.

PR 1 (docs): <PR1-SHA>
PR 2 (changelog): <PR2-SHA>

Verify-on-prod PASS on /en/docs, /ru/docs, /en/changelog, /ru/changelog.
DOM em-dash count = 0 on all 4 URLs (scoped to article.legal-article).
Section counts: 8 (docs), 5 (changelog).
RU disclaimer banner with role='note' renders on /ru/changelog only.
article.legal-article has lang='en' dir='ltr' on changelog (both locales).

Screenshots at ~/vault/projects/yt-comments/sessions/2026-05-21/tub-31-docs-changelog/screenshots/.
Spec: docs/superpowers/specs/2026-05-21-tub-30-docs-changelog-content-design.md
Plan: docs/superpowers/plans/2026-05-21-tub-31-docs-changelog-content.md
"
```

(Replace `<PR1-SHA>` and `<PR2-SHA>` with the actual SHAs from Tasks 11 and 16.)

---

### Task 19: Vault session-end summary

- [ ] **Step 1: Append session-end summary to today's daily note.** Use `mcp__obsidian__write_note` with `mode: append` on `daily/2026-05-21.md`:

```markdown
## Session Summary (HH:MM): TUB-31 Docs + Changelog content sprint

- **Goal:** Replace /docs and /changelog stub pages with production-grade bilingual content. Two PRs with verify-on-prod gates.
- **Progress:**
  - PR 1 (docs): commit `<PR1-SHA>`, 8 sections (overview, quickstart, signin, pro, formats, limits, troubleshoot, opensource). 89 new docs.* leaf keys in EN + RU.
  - PR 2 (changelog): commit `<PR2-SHA>`, 5 release sections in Keep-a-Changelog format (newest 2026-05-21, oldest 2026-05-15). 8 new changelog.* chrome keys in EN + RU.
  - Verify-on-prod PASS on all 4 URLs.
- **Decisions:** spec went through 4 review rounds (27 -> 15 -> 11 -> 1 issue trajectory). Critical round-2 catch: round 1 had RU number formatting rule inverted; shipped pricing uses ASCII space U+0020, not thin-space. Spec corrected.
- **Files (code):** `src/app/[locale]/docs/page.tsx` (full rewrite), `src/app/[locale]/changelog/page.tsx` (full rewrite), `messages/en.json` (+97 keys), `messages/ru.json` (+97 keys).
- **Files (vault):** session note at `projects/yt-comments/sessions/2026-05-21/tub-31-docs-changelog/` (full report + screenshots + spec review log).
- **Next:** TUB-31 closed. Outstanding: README Roadmap mentions "OAuth verification submission" and "per-user 10k / day YouTube quota migration" as next items.
```

- [ ] **Step 2: Write the full session note.** Use `mcp__obsidian__write_note` to create `projects/yt-comments/sessions/2026-05-21/tub-31-docs-changelog/_session.md` with:
  - Goal
  - Phase-by-phase walkthrough (brainstorm -> spec -> 4 review rounds -> plan -> 2 PRs -> verify)
  - Commit SHAs (cf85f7c 8e66a9f 7619731 ea343ce c494753 c702ce3 for spec; PR1 SHA; PR2 SHA)
  - TC-CONTENT-001..005 audit results (all pass)
  - Any claims that had to be omitted due to inability to verify (transparency)
  - Deferred follow-ups (none expected)
  - Screenshots embedded via Obsidian relative links

---

## Self-review checklist

(Run this before the executor starts Task 1.)

- **Spec coverage:** every spec § 4.x section has a docs task (Tasks 2-9 cover §§ 4.1-4.8 in order). Every spec § 5.2.x release has a changelog entry in Task 14. Spec § 3 scaffold is Task 1 + Task 13. Spec § 6 i18n keys are interleaved with section tasks. Spec § 10 verify-on-prod is Tasks 12 + 17. Spec § 11 acceptance is Tasks 18 + 19.
- **Placeholder scan:** no "TBD", "TODO", "similar to Task N" in this plan. Every code block contains exact content. Every command shows expected output. The `<PR1-SHA>` and `<PR2-SHA>` placeholders in Tasks 18-19 are explicit substitution points, not unwritten content.
- **Type consistency:** the `sections` array shape ({ id, num, tocLabel, title, body }) used in Tasks 1-9 matches the iterator in the Task 1 scaffold. The `releases` array shape ({ id, num, date, body }) used in Task 14 matches the iterator in the Task 13 scaffold. No naming drift between tasks.
- **Anti-fabrication contract verified:** every section's content traces to one of the spec § 2 authoritative sources. Every RU translation rule from spec § 6.3 + § 4.7.1 is followed in the plan's RU content.

# Tokens

Every value used in the TubeMine v3 design. Source of truth is
[`globals.css`](./globals.css). This file is a flat reference for grep-ability.

## Type

| Token | Value |
|---|---|
| `font-family-primary` | `"SF Pro Display", -apple-system, system-ui, "Inter", "Segoe UI", sans-serif` |
| `font-family-mono` | `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace` |
| `font-size-xs` | `12px` |
| `font-size-sm` | `13px` |
| `font-size-md` | `14px` (body default) |
| `font-size-lg` | `15px` |
| `font-size-xl` | `16px` |
| `font-size-2xl` | `17px` |
| `font-size-3xl` | `18px` |
| `font-size-4xl` | `21px` |
| `font-weight-base` | `400` |
| `font-weight-medium` | `500` |
| `font-weight-semibold` | `600` |
| body `line-height` | `1.55` |

Display headings use `font-weight-semibold` with `letter-spacing: -0.02em`
to `-0.03em` depending on size. See refs for exact pairings.

## Color, surfaces

| Token | Value | Usage |
|---|---|---|
| `color-surface-base` | `#000000` | Page background |
| `color-surface-raised` | `#0f0f11` | Cards, inputs, sidebars |
| `color-surface-sunken` | `#0a0a0c` | Input focused background |
| `color-surface-muted` | `#ffffff` | Inverse pill button only |

## Color, text

| Token | Value | Usage |
|---|---|---|
| `color-text-primary` | `#f5f5f7` | Default text, headings |
| `color-text-secondary` | `#b9b9c0` | Body copy, labels |
| `color-text-tertiary` | `#7a7a82` | Captions, meta, timestamps |
| `color-text-inverse` | `#0a0a0c` | On `surface-muted` (white button text) |
| `color-text-disabled` | `#4a4a52` | Disabled controls |

## Color, borders

| Token | Value | Usage |
|---|---|---|
| `color-border-subtle` | `rgba(245,245,247,0.08)` | Default card borders, dividers |
| `color-border-strong` | `rgba(245,245,247,0.16)` | Inputs, buttons, hover state |
| `color-border-focus` | `rgba(245,245,247,0.55)` | Focus rings, highlighted cards |

## Color, feedback (semantic exceptions to monochrome)

The monochrome rule has two exceptions for accessibility:
**danger** and **warning**. Plus **success** for confirmation toasts.

| Token | Value | Usage |
|---|---|---|
| `color-feedback-success` | `rgba(52,211,153,0.80)` | Success toast, check marks |
| `color-feedback-success-soft` | `rgba(52,211,153,0.12)` | Soft fill behind success |
| `color-feedback-danger` | `rgba(251,113,133,0.80)` | Destructive button, error input, cap-hit progress |
| `color-feedback-danger-soft` | `rgba(251,113,133,0.12)` | Soft fill behind danger |
| `color-feedback-warning` | `rgba(251,191,36,0.85)` | Quota approaching limit, cancellation pending |
| `color-feedback-warning-soft` | `rgba(251,191,36,0.12)` | Soft fill behind warning |

## Color, sentiment widget (scoped)

These two are **only** used inside the Sentiment widget. Do not reuse outside.

| Token | Value |
|---|---|
| `color-accent-positive` | `rgba(52,211,153,0.80)` |
| `color-accent-negative` | `rgba(251,113,133,0.80)` |
| `color-sentiment-neutral` | `var(--color-text-secondary)` |

## Spacing

| Token | Value |
|---|---|
| `spacing-1` | `4px` |
| `spacing-2` | `6px` |
| `spacing-3` | `8px` |
| `spacing-4` | `10px` |
| `spacing-5` | `12px` |
| `spacing-6` | `16px` |
| `spacing-7` | `20px` |
| `spacing-8` | `24px` |

For larger gaps (sections, hero padding), use `clamp(48px, 9vw, 96px)` style
fluid values. See refs for examples.

## Radius

| Token | Value | Usage |
|---|---|---|
| `radius-xs` | `6px` | Small chips, copy-button |
| `radius-sm` | `8px` | Inputs, secondary cards |
| `radius-md` | `14px` | Primary cards, toasts |
| `radius-lg` | `9999px` | Pill buttons, badges, progress fill |

## Shadow

| Token | Value | Usage |
|---|---|---|
| `shadow-1` | `0 24px 80px 0 rgba(0,0,0,0.18)` | Toasts, dashboard mock |
| `shadow-2` | `0 10px 34px 0 rgba(245,245,247,0.08)` | Raised cards, demo block |

## Motion

| Token | Value | Usage |
|---|---|---|
| `duration-instant` | `140ms` | hover ↔ idle |
| `duration-fast` | `150ms` | button + input feedback |
| `duration-normal` | `200ms` | accordion, drawer, sheet |
| `ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | every transition |

## Layout

| Token | Value | Usage |
|---|---|---|
| `layout-sidebar-w` | `240px` | Dashboard + profile left rail |
| `layout-header-h` | `60px` | Topbar height across all auth pages |

## Touch targets

Mobile minimum touch target: **44px**. Desktop minimum: **36px**.

Components that ship at 36px visual height (button-sm, accordion caret) must
add 8px of invisible touch margin on mobile via `min-height: 44px`.

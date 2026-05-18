// Strict allow-list for the OAuth callback ?next= param. The param is
// attacker-controlled at click time, so a permissive sanitizer would create an
// open-redirect (e.g. next=https://evil.com). Only internal locale-prefixed
// routes pass.
const NEXT_RE = /^\/(en|ru)\/[\w\-/]*$/

export function safeNext(raw: string | null): string {
  if (!raw) return "/"
  if (!NEXT_RE.test(raw)) return "/"
  return raw
}

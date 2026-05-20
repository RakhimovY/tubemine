# TubeMine v3 E2E Runbook

Manual end-to-end tests to execute against the deployed Vercel preview URL before merging to main. Phase 0 has no Playwright in the repo; this is the source of truth for Phase 12 smoke tests.

Replace `<preview>` with the Vercel preview URL (e.g. `https://tubemine-git-redesign-yerkebulans-projects.vercel.app`).

---

## OAuth round-trip preserves locale

1. Open `<preview>/ru/history` in incognito.
2. Verify 307 redirect to `<preview>/ru/login?next=%2Fru%2Fhistory`.
3. Click "Войти через Google".
4. Complete Google OAuth.
5. **Pass:** land on `<preview>/ru/history`, chrome (header + footer) rendered in RU.
6. **Fail:** land anywhere else, especially `/en/...` or `/`.

---

## Open-redirect rejection

1. In a browser, visit each crafted URL below:
   - `<preview>/auth/callback?next=https://evil.com&code=fake`
   - `<preview>/auth/callback?next=//evil.com&code=fake`
   - `<preview>/auth/callback?next=/ru/../../evil&code=fake`
   - `<preview>/auth/callback?next=javascript:alert(1)&code=fake`
2. Check the redirect target via DevTools Network panel.
3. **Pass:** redirected to `<preview>/` (root). Never reaches `evil.com` or fires the `alert(1)`.
4. **Fail:** any redirect to `evil.com`, any external host, or the `javascript:` URL fires.

Automated via curl:

```bash
PREVIEW_URL=<your-preview-url>
for n in "https://evil.com" "//evil.com" "/en/../../evil" "javascript:alert(1)"; do
  echo "Testing next=$n"
  curl -sI "$PREVIEW_URL/auth/callback?next=$(printf %s "$n" | jq -sRr @uri)&code=fake" \
    | grep -i location || echo "(no Location header)"
done
```

Every Location header must be the preview origin root (`/`). If any leaks → halt deploy, fix `safeNext` regex in `src/app/auth/callback/safe-next.ts`, redeploy.

---

## Locale switcher persists

1. Visit `<preview>/en/` in incognito.
2. Inspect cookies: `NEXT_LOCALE` absent or `en`.
3. Click the LocaleSwitcher in the header, change to `RU`.
4. URL becomes `<preview>/ru/`.
5. Inspect cookies: `NEXT_LOCALE=ru`, 1-year expiry (`Max-Age=31536000`), `SameSite=Lax`, `Secure`.
6. Close tab. Reopen `<preview>/`. **Pass:** redirects to `<preview>/ru/`.
7. **Fail:** redirects to `<preview>/en/` (cookie ignored) or no redirect (root stays bare).

---

## Locale detection precedence (Accept-Language)

Test the SPEC section 4.4 highest-q-must-be-ru rule.

```bash
PREVIEW_URL=<your-preview-url>

# Empty header: defaults to /en
curl -sI "$PREVIEW_URL/" | grep -i location
# Expected: Location: /en

# Russian primary
curl -sI -H "Accept-Language: ru-RU,ru;q=0.9" "$PREVIEW_URL/" | grep -i location
# Expected: Location: /ru

# Ukrainian primary, Russian fallback. SPEC: highest-q (uk) wins, falls back to /en.
curl -sI -H "Accept-Language: uk-UA,uk;q=0.9,ru;q=0.5" "$PREVIEW_URL/" | grep -i location
# Expected: Location: /en (NOT /ru)
```

---

## History delete idempotency

1. Sign in. Extract any YouTube video.
2. Visit `/en/history`. Verify the row exists.
3. Open DevTools → Network. Click Delete on the row → Confirm in dialog. Inspect the DELETE request.
4. **Pass:** returns `200 { deleted: 1 }`. Row removed from UI.
5. Manually resend the DELETE (DevTools "Replay" or curl with the same id):
   ```bash
   curl -X DELETE -i \
     -H "cookie: <your-supabase-auth-cookie>" \
     "$PREVIEW_URL/api/analyses/<row-id>"
   ```
6. **Pass:** returns `200 { deleted: 0 }`. No error toast.
7. **Pass:** sending DELETE without an auth cookie returns 401.
8. **Pass:** sending DELETE with a non-UUID id returns 401 (auth always first) when anonymous, or 400 when signed in.

---

## Cron purge end-to-end (production only)

Cron only runs on production deployments. Verify in Vercel Dashboard → Project → Cron Jobs:

1. The job `/api/internal/cron/purge-analyses` is listed with schedule `0 3 * * *`.
2. After first cron run (or manual trigger via Vercel UI), check Runtime Logs:
   - Filter: `[analyses] cron purge`
   - Expected line: `[analyses] cron purge { purged: <N>, durationMs: <ms> }`

Manual trigger via curl (production only):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://tubemine.tech/api/internal/cron/purge-analyses
# Expected: {"purged": <N>}
```

`CRON_SECRET` value is in Vercel project env (production scope). Do NOT hardcode in this file.

---

## Save side-effect (extract while signed in)

1. Sign in as test user.
2. Extract a video (video A). Note the videoId.
3. Visit `/en/history`. **Pass:** video A appears at the top of the grid.
4. Visit `/en/dashboard`. **Pass:** the RecentAnalyses widget shows video A.
5. Re-extract video A. **Pass:** in `/en/history`, the row is at the top with refreshed `processed_at` (UPSERT). Only one row for video A (no duplicate).
6. Extract a video while anonymous. **Pass:** no row appears when you sign in.

---

## Disclaimer block on /ru legal pages

1. Visit `/ru/privacy`. **Pass:** yellow disclaimer block at top: "Эта страница пока доступна только на английском..."
2. Visit `/ru/terms`. Same disclaimer.
3. Visit `/ru/changelog`. **Pass:** disclaimer reads "Журнал изменений ведётся на английском."
4. Visit `/en/privacy`, `/en/terms`, `/en/changelog`. **Pass:** no disclaimer block.

---

## hreflang + canonical

1. Curl `/en/`:
   ```bash
   curl -s "$PREVIEW_URL/en/" | grep -E 'hreflang|canonical'
   ```
2. **Pass:** see `<link rel="alternate" hreflang="en" href=".../en">`, `hreflang="ru"`, `hreflang="x-default"`, `<link rel="canonical" href=".../en">`.

---

## Sitemap

```bash
curl -s "$PREVIEW_URL/sitemap.xml" | head -50
```

**Pass:** entries for both `/en/` and `/ru/` for: `""`, `/pricing`, `/login`, `/docs`, `/changelog`, `/privacy`, `/terms`.

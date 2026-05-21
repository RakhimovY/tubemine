-- TUB-34: cache per-comment data for instant re-view and zero-YT-quota exports.
-- comments stores small payloads inline as JSONB; large payloads go to the
-- analyses-comments storage bucket and comments_blob_path holds the key.
-- Both columns nullable; existing rows (pre-TUB-34) keep null on both = "legacy".

alter table public.analyses
  add column if not exists comments jsonb,
  add column if not exists comments_blob_path text;

-- No new RLS policies: column-level reads inherit the row policy.
-- INSERT/UPDATE remain service-role-only (no policy = default deny for non-service).

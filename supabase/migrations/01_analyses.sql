-- TubeMine Phase 3: saved analyses with 30-day retention

create table public.analyses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  video_id        text not null,
  video_title     text,
  channel_name    text,
  thumbnail_url   text,
  comment_count   int  not null,
  sentiment       jsonb,
  top_words       jsonb,
  emoji_frequency jsonb,
  processed_at    timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '30 days'),
  unique (user_id, video_id)
);

create index analyses_user_id_processed_at
  on public.analyses (user_id, processed_at desc);

create index analyses_expires_at
  on public.analyses (expires_at);

alter table public.analyses enable row level security;

create policy "users read own analyses"
  on public.analyses for select
  using (auth.uid() = user_id);

create policy "users delete own analyses"
  on public.analyses for delete
  using (auth.uid() = user_id);

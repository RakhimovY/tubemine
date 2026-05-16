-- TubeMine Phase 1 schema
-- Tables: profiles, usage, subscriptions, webhook_events
-- All RLS-protected. Users can read own rows. All writes go through service role
-- (webhook handler + extract route).

-- ─── profiles ────────────────────────────────────────────────────────────────

create table public.profiles (
  user_id         uuid primary key references auth.users on delete cascade,
  tier            text not null default 'free' check (tier in ('free', 'pro')),
  welcome_sent_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Auto-create a profile row when a user signs up via auth.users.
create function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── usage (per-user monthly comment budget) ─────────────────────────────────

create table public.usage (
  user_id       uuid not null references auth.users on delete cascade,
  month         date not null,           -- always set to first-of-month, UTC
  comments_used int  not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.usage enable row level security;

create policy "users read own usage"
  on public.usage for select
  using (auth.uid() = user_id);

-- Atomically increment a user's usage for the current UTC month.
-- Returns the new comments_used value. Race-free via INSERT ... ON CONFLICT.
create function public.bump_usage(uid uuid, delta int)
returns int as $$
declare
  current_month date := date_trunc('month', now() at time zone 'utc')::date;
  new_total     int;
begin
  insert into public.usage (user_id, month, comments_used, updated_at)
  values (uid, current_month, delta, now())
  on conflict (user_id, month) do update
    set comments_used = public.usage.comments_used + excluded.comments_used,
        updated_at    = now()
  returning comments_used into new_total;

  return new_total;
end;
$$ language plpgsql security definer set search_path = public;

-- ─── subscriptions ──────────────────────────────────────────────────────────

create table public.subscriptions (
  user_id              uuid primary key references auth.users on delete cascade,
  polar_subscription_id text unique,
  polar_customer_id    text,
  status               text not null,                -- active | canceled | revoked | past_due
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "users read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ─── webhook_events (idempotency log) ───────────────────────────────────────

create table public.webhook_events (
  event_id    text primary key,
  event_type  text not null,
  received_at timestamptz not null default now()
);

-- No RLS: only service role inserts. Users never read this.

-- ─── notes ──────────────────────────────────────────────────────────────────
-- 1. To downgrade a user when their canceled subscription's period ends, either:
--    a) Run a daily cron that flips profiles.tier to 'free' where
--       subscriptions.status = 'canceled' and current_period_end < now().
--    b) Compute effective tier on read: tier = pro iff status = 'active' OR
--       (status = 'canceled' AND current_period_end > now()).
--    Phase 1 uses (b) — see lib/quota.ts.
-- 2. profiles.tier reflects the *paid* tier. Effective access is derived in app
--    code from (profiles.tier, subscriptions.status, current_period_end).

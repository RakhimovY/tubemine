-- TubeMine: add Google OAuth metadata to profiles
-- Captures email, full_name, avatar_url from auth.users.raw_user_meta_data
-- at signup. Trigger updated to copy these on insert. Backfill applies the
-- same logic to all existing rows.

alter table public.profiles
  add column email      text,
  add column full_name  text,
  add column avatar_url text;

-- Replace the trigger to copy Google OAuth metadata on signup.
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (user_id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Backfill existing profiles from auth.users.
update public.profiles p
set
  email      = u.email,
  full_name  = coalesce(
                 u.raw_user_meta_data->>'full_name',
                 u.raw_user_meta_data->>'name'
               ),
  avatar_url = coalesce(
                 u.raw_user_meta_data->>'avatar_url',
                 u.raw_user_meta_data->>'picture'
               )
from auth.users u
where p.user_id = u.id and p.email is null;

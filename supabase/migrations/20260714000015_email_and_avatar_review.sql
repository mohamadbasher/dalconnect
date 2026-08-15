-- ============================================================
-- DalConnect — contact email, and avatar moderation
--
-- 1. EMAIL. The address on the auth user is synthetic (<phone>@phone.
--    dalconnect.app) and exists only because Supabase needs a unique email per
--    account — it is not a real inbox. This is the customer's actual email, for
--    receipts and account recovery. Treated like `phone`: NOT world-readable,
--    so it is deliberately left out of the column grant added in
--    20260714000011 and reaches its owner through get_my_profile().
--
-- 2. AVATAR REVIEW. Profile photos are user-supplied images shown to strangers
--    next to a real name. Someone will eventually upload something obscene or
--    someone else's face, so an upload no longer becomes the visible avatar
--    directly: it lands in `pending_avatar_url` for an admin to approve.
--    `avatar_url` — the one everyone else sees — is writable only by an admin.
-- ============================================================

alter table profiles
  add column if not exists email              text,
  add column if not exists pending_avatar_url text,
  add column if not exists avatar_status      text not null default 'none';

do $$
begin
  alter table profiles
    add constraint profiles_avatar_status_check
    check (avatar_status in ('none', 'pending', 'approved', 'rejected'));
exception when duplicate_object then null;
end $$;

comment on column profiles.email is
  'The user''s real contact address. NOT the synthetic auth email, and NOT in the
   public column grant — same treatment as phone.';
comment on column profiles.pending_avatar_url is
  'An uploaded photo awaiting admin review. Becomes avatar_url on approval.';

-- Admins need to find the queue quickly; everyone else never queries this.
create index if not exists profiles_avatar_pending_idx
  on profiles (id) where avatar_status = 'pending';

-- The three new columns are intentionally NOT added to the column grant from
-- 20260714000011, so `authenticated` cannot select them at all. New columns on
-- a column-granted table start with no privileges, so this needs no statement
-- — but it does need saying, because it is easy to "fix" later by mistake.

-- ---------- guard ----------
-- Re-declared with the avatar rules on top of the existing role/ban/phone
-- checks. The pattern is by now the house rule: RLS says which ROWS, a BEFORE
-- UPDATE trigger says which COLUMNS.
create or replace function protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then return new; end if;

  if new.role is distinct from old.role and not (old.role = 'customer' and new.role = 'professional') then
    raise exception 'role change not allowed';
  end if;
  if new.is_banned is distinct from old.is_banned then
    raise exception 'ban change not allowed';
  end if;
  if new.phone_verified is distinct from old.phone_verified
     and coalesce(current_setting('dalconnect.trusted_write', true), '') <> 'on' then
    raise exception 'phone verification is set by the platform, not the account';
  end if;

  -- The visible avatar is the platform's word that this photo was looked at.
  -- Only an admin may set it, or the review means nothing.
  if new.avatar_url is distinct from old.avatar_url
     and coalesce(current_setting('dalconnect.trusted_write', true), '') <> 'on' then
    raise exception 'a profile photo has to be approved before it is shown';
  end if;

  -- Submitting for review is allowed; declaring the outcome is not.
  if new.avatar_status is distinct from old.avatar_status
     and new.avatar_status <> 'pending'
     and coalesce(current_setting('dalconnect.trusted_write', true), '') <> 'on' then
    raise exception 'only an admin can approve or reject a profile photo';
  end if;

  return new;
end;
$$;

-- ---------- admin actions ----------
create or replace function approve_avatar(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  perform trusted_write_on();
  update profiles
     set avatar_url         = pending_avatar_url,
         pending_avatar_url = null,
         avatar_status      = 'approved'
   where id = p_user_id
     and pending_avatar_url is not null;
end;
$$;

create or replace function reject_avatar(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  perform trusted_write_on();
  -- The previously approved avatar (if any) stays; only the submission goes.
  update profiles
     set pending_avatar_url = null,
         avatar_status      = 'rejected'
   where id = p_user_id;
end;
$$;

revoke execute on function approve_avatar(uuid) from public, anon;
revoke execute on function reject_avatar(uuid)  from public, anon;
grant execute on function approve_avatar(uuid) to authenticated;
grant execute on function reject_avatar(uuid)  to authenticated;

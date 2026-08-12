-- ============================================================
-- DalConnect — separate service-provider accounts
--
-- A professional now REGISTERS as a professional; there is no "upgrade a
-- customer account" path. The same person may hold BOTH a customer account and
-- a provider account on the same phone number, so phone is deliberately not
-- unique.
--
-- Login identity (mirrors Dal's merchantNo, adapted to Supabase Auth, which
-- requires a globally unique email per account):
--   customer  ->  <phone>@phone.dalconnect.app     e.g. 0521234567@phone...
--   provider  ->  <provider_no>@pro.dalconnect.app e.g. 234567@pro...
--
-- provider_no is the LAST SIX DIGITS of the phone, falling back to a random
-- six-digit number when those are already taken. Because it is the local part
-- of the login email, Supabase enforces its uniqueness for us — and a 6-digit
-- login can never collide with a 10-digit phone login.
-- ============================================================

alter table profiles
  add column if not exists provider_no text unique,
  -- groundwork for SMS verification (deferred): every existing account counts
  -- as unverified, so switching it on later needs no backfill
  add column if not exists phone_verified boolean not null default false;

comment on column profiles.provider_no is
  'Six-digit login ID for service providers (last 6 digits of the phone, or a random fallback). Null for customers.';

create index if not exists profiles_phone_role_idx on profiles (phone, role);

-- ------------------------------------------------------------
-- Profile creation now honours the role and provider number chosen at signup.
-- ------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wanted_role  user_role;
  wanted_no    text;
begin
  -- Only these two roles may ever be self-assigned at signup; admin is granted
  -- manually and anything unexpected falls back to the least-privileged role.
  wanted_role := case
    when coalesce(new.raw_user_meta_data->>'role', '') = 'professional' then 'professional'::user_role
    else 'customer'::user_role
  end;

  wanted_no := nullif(new.raw_user_meta_data->>'provider_no', '');
  if wanted_role <> 'professional' then
    wanted_no := null;                       -- customers never carry one
  elsif wanted_no !~ '^\d{6}$' then
    raise exception 'provider_no must be exactly six digits';
  end if;

  insert into profiles (id, full_name, phone, lang, role, provider_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'lang', 'ar'),
    wanted_role,
    wanted_no
  );

  -- A provider account is useless without its professional row, and it must
  -- start unapproved so staff can vet it.
  if wanted_role = 'professional' then
    insert into professionals (id, business_name, verification_status)
    values (new.id, coalesce(new.raw_user_meta_data->>'business_name', ''), 'pending')
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- Registration helpers (SECURITY DEFINER: they answer yes/no questions about
-- accounts without exposing any row to an anonymous caller).
-- ------------------------------------------------------------

/** Is there already a PROVIDER account on this phone? (A customer one is fine.) */
create or replace function provider_exists_for_phone(p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where role = 'professional'
      and regexp_replace(phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
  );
$$;

/** Is this six-digit login ID still free? */
create or replace function provider_no_available(p_no text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_no ~ '^\d{6}$'
     and not exists (select 1 from profiles where provider_no = p_no);
$$;

/**
 * The login ID to offer a provider signing up with this phone: the last six
 * digits when free, otherwise a random unused six-digit number.
 */
create or replace function suggest_provider_no(p_phone text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  digits    text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  preferred text;
  candidate text;
begin
  if length(digits) >= 6 then
    preferred := right(digits, 6);
    if provider_no_available(preferred) then
      return preferred;
    end if;
  end if;

  for i in 1..25 loop
    candidate := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
    if provider_no_available(candidate) then
      return candidate;
    end if;
  end loop;

  raise exception 'could not allocate a provider number';
end;
$$;

revoke execute on function provider_exists_for_phone(text) from public;
revoke execute on function provider_no_available(text)     from public;
revoke execute on function suggest_provider_no(text)       from public;
grant  execute on function provider_exists_for_phone(text) to anon, authenticated;
grant  execute on function provider_no_available(text)     to anon, authenticated;
grant  execute on function suggest_provider_no(text)       to anon, authenticated;

-- ------------------------------------------------------------
-- Backfill: any professional created under the old "upgrade" flow still needs
-- a login number, otherwise they could never sign in on the new provider path.
-- ------------------------------------------------------------
do $$
declare r record; n text;
begin
  for r in select p.id, p.phone from profiles p
           where p.role = 'professional' and p.provider_no is null loop
    begin
      n := suggest_provider_no(r.phone);
      update profiles set provider_no = n where id = r.id;
    exception when others then
      -- never let one bad row abort the migration
      null;
    end;
  end loop;
end $$;

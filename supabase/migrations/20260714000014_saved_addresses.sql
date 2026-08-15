-- ============================================================
-- DalConnect — saved addresses
--
-- Home services go to the same handful of places over and over: your flat, your
-- parents', the shop. Re-typing the street and re-picking the city on every
-- request is the most repeated friction in the whole flow, and it's the step
-- most likely to be filled in wrongly when someone is in a hurry — which then
-- routes the request to the wrong city's professionals.
--
-- Column guard included from the start, per the rule the security audit
-- established: RLS says which ROWS you may write and nothing about which
-- COLUMNS, so an owner-scoped policy alone would let someone re-point a saved
-- address at another user.
-- ============================================================

create table if not exists saved_addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  -- free text so people can name places how they think of them ("בית", "אמא",
  -- "המשרד"), with the app offering the common ones as suggestions
  label       text not null,
  city_id     int references cities(id),
  address     text not null default '',
  lat         double precision,
  lng         double precision,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists saved_addresses_user_idx on saved_addresses (user_id, created_at desc);

-- At most one default per user, enforced by the database rather than by
-- whichever screen happens to write last.
create unique index if not exists saved_addresses_one_default
  on saved_addresses (user_id) where is_default;

alter table saved_addresses enable row level security;

drop policy if exists saved_addresses_own on saved_addresses;
create policy saved_addresses_own on saved_addresses
  for all
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- Belt to the policy's braces: `with check` already pins user_id on write, but
-- an explicit guard keeps the rule visible next to the table and survives
-- anyone loosening the policy later.
create or replace function guard_saved_address_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() or auth.uid() is null then
    return new;
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'a saved address cannot be moved to another account'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists a_guard_saved_address_update_trigger on saved_addresses;
create trigger a_guard_saved_address_update_trigger
  before update on saved_addresses
  for each row execute function guard_saved_address_update();

-- Setting a new default clears the old one, so the unique index above never has
-- to reject a perfectly reasonable "make this my default" tap.
--
-- BEFORE, not AFTER: a non-deferrable unique index is checked as each row is
-- written, so an AFTER trigger clears the previous default too late — the new
-- row is rejected first and the clean-up never runs. Doing it BEFORE means the
-- old default is already false by the time this row hits the index. The inner
-- UPDATE re-enters this trigger for those rows, which is harmless: their
-- new.is_default is false, so it returns immediately.
create or replace function clear_other_default_addresses() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_default then
    update saved_addresses
       set is_default = false
     where user_id = new.user_id
       and id <> new.id
       and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_other_default_addresses_trigger on saved_addresses;
create trigger clear_other_default_addresses_trigger
  before insert or update of is_default on saved_addresses
  for each row execute function clear_other_default_addresses();

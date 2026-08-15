-- ============================================================
-- DalConnect — stop every signed-in user reading every phone number
--
-- THE most severe finding of the audit, because it doesn't just leak data — it
-- dissolves the business model. The product is "post a request, compare quotes,
-- and the professional's phone number is revealed only once you accept one",
-- with the platform taking a commission on the job that follows. get_contact_
-- phone enforces exactly that, and enforces it correctly.
--
-- But `profiles_read` is `using (true)` and `authenticated` held a TABLE-level
-- SELECT grant on profiles, which has a `phone` column. So any signed-in user
-- could simply run:
--
--   select full_name, phone from profiles;
--
-- and walk away with every customer's and every professional's number, without
-- posting a request, accepting a quote, or paying a commission. Verified live
-- as an ordinary customer before this migration.
--
-- RLS is row-level and cannot express "this column, to these people", so the
-- fix is column-level GRANTs. Note the table-level grant had to be dropped
-- first: a column-level REVOKE against a table-level grant is silently a no-op,
-- which is why an earlier attempt at this appeared to change nothing.
-- ============================================================

revoke select on profiles from anon, authenticated;

-- Everything except `phone`. Kept deliberately explicit rather than generated,
-- so that adding a sensitive column later is a decision someone has to make
-- here rather than something that silently becomes world-readable.
grant select (
  id, role, full_name, avatar_url, city_id, lang,
  is_banned, created_at, permissions, provider_no, phone_verified
) on profiles to anon, authenticated;

-- Reading your OWN phone is legitimate — the profile and edit-profile screens
-- show it. Column grants can't say "only your row", so that one case goes
-- through a definer function instead.
create or replace function get_my_profile() returns profiles
language sql security definer stable set search_path = public as $$
  select * from profiles where id = auth.uid();
$$;

revoke execute on function get_my_profile() from anon;
grant execute on function get_my_profile() to authenticated;

comment on function get_my_profile() is
  'The caller''s own profile row, including phone. Everyone else''s phone is
   unreadable by design — use get_contact_phone(booking) for a counterparty,
   which checks that a quote was actually accepted first.';

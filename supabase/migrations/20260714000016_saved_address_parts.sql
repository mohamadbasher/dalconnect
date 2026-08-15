-- ============================================================
-- DalConnect — structured saved addresses
--
-- `address` was one free-text line. That is fine to store and useless to act
-- on: a professional standing outside a building needs the floor and the flat
-- number as separate, reliable facts, not buried in a sentence someone typed in
-- a hurry. And "entrance from the back" is an instruction, not part of the
-- address — it belongs in its own field so it can be shown differently.
--
-- `address` is kept, not dropped: rows created before this migration hold their
-- whole address in it, and bookings still carry a single address line. The app
-- composes that line from the parts, with the labels translated — which is why
-- composition happens in the app and not in a trigger here. Putting "קומה" into
-- a database function would hard-code one of the two languages this app speaks.
-- ============================================================

alter table saved_addresses
  add column if not exists street       text not null default '',
  add column if not exists house_number text not null default '',
  add column if not exists floor        text,
  add column if not exists apartment    text,
  add column if not exists notes        text;

comment on column saved_addresses.notes is
  'How to find the place once you are there — "entrance from the back", "next to
   the pharmacy". Directions for a human, not part of the postal address.';

-- Existing rows kept everything in `address`; the street is the best guess for
-- what that text was, and nothing is lost either way since `address` stays.
update saved_addresses
   set street = address
 where street = '' and coalesce(address, '') <> '';

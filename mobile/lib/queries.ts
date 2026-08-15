/**
 * Shared PostgREST column lists.
 *
 * `profiles` can no longer be selected with `*`: migration 20260714000011
 * removed the table-level SELECT grant and re-granted every column except
 * `phone`, because `select phone from profiles` let any signed-in user harvest
 * every number in the database and skip the accept-a-quote step the whole
 * commission model rests on. A `select=*` against a column-granted table is a
 * hard "permission denied for table profiles", not a partial row — so every
 * embed has to name its columns.
 *
 * Your OWN phone still comes back, via the get_my_profile() RPC. A
 * counterparty's comes from get_contact_phone(booking), which checks the quote
 * was accepted first.
 */
export const PROFILE_FIELDS =
  "id, role, full_name, avatar_url, city_id, lang, is_banned, created_at, permissions, provider_no, phone_verified";

// Phone privacy (migration 20260714000011) + the app still working.
//
// The product's whole economics rest on "the number is revealed only after you
// accept a quote". This asserts the harvest is dead AND that every screen's
// real query still runs — the fix removes a table-level grant, so a missed
// `select=*` anywhere is an instant "permission denied", not a subtle bug.
// Run from mobile/.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../mobile/.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PROFILE_FIELDS =
  "id, role, full_name, avatar_url, city_id, lang, is_banned, created_at, permissions, provider_no, phone_verified";
const anon = () => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};

const db = anon();
const { data: a, error: aErr } = await db.auth.signInWithPassword({
  email: "0501111111@phone.dalconnect.app", password: "123456",
});
if (aErr) { console.error("sign-in failed:", aErr.message); process.exit(1); }
const uid = a.user.id;

console.log("1. The harvest is dead");
{
  const { data, error } = await db.from("profiles").select("phone").neq("id", uid).limit(5);
  check("cannot select phone for other users", !!error && !data, error?.message?.slice(0, 55) ?? "STILL LEAKS");
}
{
  const { data, error } = await db.from("profiles").select("id, full_name, phone").limit(1);
  check("cannot sneak phone into a mixed column list", !!error, error?.message?.slice(0, 55) ?? "STILL LEAKS");
}
{
  const { error } = await db.from("profiles").select("*").limit(1);
  check("bare select(*) on profiles is refused", !!error, error?.message?.slice(0, 55) ?? "returned rows");
}

console.log("\n2. Your OWN phone still works (profile + edit-profile screens)");
{
  const { data, error } = await db.rpc("get_my_profile").single();
  check("get_my_profile returns own row with phone", !error && !!data?.phone, error?.message ?? `phone=${data?.phone}`);
  check("and it is genuinely MY row", data?.id === uid);
}

console.log("\n3. Every screen's real query still runs");
const queries = [
  ["bookings tab", () => db.from("bookings").select(`*, category:categories(*), professional:professionals(*, profile:profiles!professionals_id_fkey(${PROFILE_FIELDS}))`).limit(1)],
  ["booking detail", () => db.from("bookings").select(`*, category:categories(*), city:cities(*), professional:professionals(*, profile:profiles!professionals_id_fkey(${PROFILE_FIELDS}))`).limit(1)],
  ["booking detail offers", () => db.from("offers").select(`*, professional:professionals(*, profile:profiles!professionals_id_fkey(${PROFILE_FIELDS}), city:cities(*))`).limit(1)],
  ["chat list", () => db.from("conversations").select(`*, customer:profiles!conversations_customer_id_fkey(${PROFILE_FIELDS}), professional:profiles!conversations_professional_id_fkey(${PROFILE_FIELDS})`).limit(1)],
  ["pro profile page", () => db.from("professionals").select(`*, profile:profiles!professionals_id_fkey(${PROFILE_FIELDS}), professional_categories(category:categories(*)), city:cities(*)`).limit(1)],
  ["pro dashboard (open requests)", () => db.from("bookings").select(`*, category:categories(*), customer:profiles!bookings_customer_id_fkey(${PROFILE_FIELDS}), city:cities(*)`).limit(1)],
  ["categories / cities refdata", () => db.from("categories").select("*").limit(1)],
  ["own professional row", () => db.from("professionals").select("*").eq("id", uid).maybeSingle()],
];
for (const [name, fn] of queries) {
  const { error } = await fn();
  check(name, !error, error?.message?.slice(0, 70) ?? "");
}

console.log("\n4. Profile edits still save");
{
  const { data: before } = await db.rpc("get_my_profile").single();
  const { error } = await db.from("profiles").update({ full_name: before.full_name }).eq("id", uid);
  check("update own profile still permitted", !error, error?.message?.slice(0, 55) ?? "");
}

console.log("\n5. The legitimate reveal path is untouched");
{
  const { data: bk } = await db.from("bookings").select("id, status").eq("customer_id", uid)
    .in("status", ["accepted", "on_the_way", "in_progress", "completed", "rated"]).limit(1);
  if (bk?.length) {
    const { data, error } = await db.rpc("get_contact_phone", { p_booking_id: bk[0].id });
    check("get_contact_phone returns the number on an accepted job", !error && !!data, error?.message ?? `got ${data}`);
  } else {
    const { data: open } = await db.from("bookings").select("id").eq("customer_id", uid).eq("status", "open").limit(1);
    if (open?.length) {
      const { data } = await db.rpc("get_contact_phone", { p_booking_id: open[0].id });
      check("get_contact_phone still withholds on an unaccepted job", data === null, `got ${JSON.stringify(data)}`);
    } else check("(no booking to test the reveal path)", true);
  }
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

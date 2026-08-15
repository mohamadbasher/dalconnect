// Saved addresses (migration 20260714000014): behaviour + isolation.
//
// Checks the one-default-per-user invariant is enforced by the DATABASE rather
// than by whichever screen wrote last, and that one user's addresses are
// invisible and untouchable to another. Run from mobile/.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../mobile/.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const anon = () => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`  ${ok ? "OK  " : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

const me = anon();
const { data: a, error: aErr } = await me.auth.signInWithPassword({
  email: "0501111111@phone.dalconnect.app", password: "123456",
});
if (aErr) { console.error("sign-in failed:", aErr.message); process.exit(1); }
const uid = a.user.id;

const other = anon();
const { data: b } = await other.auth.signInWithPassword({ email: "000001@pro.dalconnect.app", password: "123456" });
const otherId = b.user.id;

const { data: cities } = await me.from("cities").select("id").limit(2);

// start clean
await me.from("saved_addresses").delete().eq("user_id", uid);

console.log("1. Create and read back");
let home, work;
{
  const { data, error } = await me.from("saved_addresses")
    .insert({ user_id: uid, label: "בית", city_id: cities[0].id, address: "רחוב 1", is_default: true })
    .select("*").single();
  home = data;
  check("created a default address", !error && data?.is_default === true, error?.message?.slice(0, 55) ?? "");
}
{
  const { data, error } = await me.from("saved_addresses")
    .insert({ user_id: uid, label: "עבודה", city_id: cities[1].id, address: "רחוב 2", is_default: false })
    .select("*").single();
  work = data;
  check("created a second, non-default address", !error && data?.is_default === false, error?.message?.slice(0, 55) ?? "");
}

console.log("\n2. Exactly one default, enforced by the database");
{
  const { error } = await me.from("saved_addresses").update({ is_default: true }).eq("id", work.id);
  check("promoting the second one is allowed", !error, error?.message?.slice(0, 55) ?? "");
  const { data } = await me.from("saved_addresses").select("id, label, is_default").eq("user_id", uid);
  const defaults = data.filter((r) => r.is_default);
  check("the old default was cleared automatically", defaults.length === 1,
    `${defaults.length} default(s): ${defaults.map((d) => d.label).join(", ")}`);
  check("and it is the one just promoted", defaults[0]?.id === work.id);
}

console.log("\n3. Another user cannot see or touch them");
{
  const { data } = await other.from("saved_addresses").select("*").eq("user_id", uid);
  check("other user sees none of my addresses", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`);
}
{
  const { data, error } = await other.from("saved_addresses").update({ label: "HIJACKED" }).eq("id", home.id).select("id");
  check("other user cannot edit my address", !!error || !data?.length, error?.message?.slice(0, 50) ?? "(0 rows)");
}
{
  const { data, error } = await other.from("saved_addresses").delete().eq("id", home.id).select("id");
  check("other user cannot delete my address", !!error || !data?.length, error?.message?.slice(0, 50) ?? "(0 rows)");
}
{
  const { error } = await other.from("saved_addresses")
    .insert({ user_id: uid, label: "PLANTED", city_id: cities[0].id });
  check("other user cannot plant an address in my account", !!error, error?.message?.slice(0, 50) ?? "PLANTED IT");
}

console.log("\n4. Cannot move my own address to someone else");
{
  const { data, error } = await me.from("saved_addresses")
    .update({ user_id: otherId }).eq("id", home.id).select("id");
  check("reassigning user_id is refused", !!error || !data?.length, error?.message?.slice(0, 55) ?? "(0 rows)");
}

console.log("\n5. Delete works for the owner");
{
  const { error } = await me.from("saved_addresses").delete().eq("id", home.id);
  check("owner can delete their own address", !error, error?.message?.slice(0, 50) ?? "");
}

await me.from("saved_addresses").delete().eq("user_id", uid);
const { data: left } = await me.from("saved_addresses").select("id").eq("user_id", uid);
check("cleaned up", (left?.length ?? 0) === 0);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

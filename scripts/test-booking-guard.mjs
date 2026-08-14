// Column-level guard on bookings (migration 20260714000008).
//
// RLS says which ROWS you may touch; it cannot say which COLUMNS. Before the
// guard existed, a customer could close their own job with final_price = 0 and
// commission = 0. This asserts the edit fields still work and the money fields
// still do not. Run it from mobile/ (it needs @supabase/supabase-js).
// Signs in as the demo customer, creates a throwaway open request, then tries
// each write in turn. Cleans up after itself.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../mobile/.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const db = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const { data: auth, error: authErr } = await db.auth.signInWithPassword({
  email: "0501111111@phone.dalconnect.app", password: "123456",
});
if (authErr) { console.error("sign-in failed:", authErr.message); process.exit(1); }
const uid = auth.user.id;
console.log("signed in as demo customer", uid.slice(0, 8));

const { data: cat } = await db.from("categories").select("id").eq("slug", "electrician").single();
const { data: city } = await db.from("cities").select("id").limit(1).single();

const { data: bk, error: insErr } = await db.from("bookings").insert({
  type: "open", status: "open", customer_id: uid, category_id: cat.id,
  title: "RLS probe", description: "throwaway row for a security check",
  photos: [], city_id: city.id, address: "", urgency: "scheduled",
}).select("*").single();
if (insErr) { console.error("insert failed:", insErr.message); process.exit(1); }
console.log("created throwaway booking", bk.id.slice(0, 8), "\n");

let holes = 0;
const probe = async (name, patch, shouldBeAllowed) => {
  const { data, error } = await db.from("bookings").update(patch).eq("id", bk.id).select("*");
  // RLS silently returns 0 rows when the policy blocks the row
  const applied = !error && data && data.length > 0;
  const ok = applied === shouldBeAllowed;
  if (!ok && applied) holes++;
  const verdict = ok ? "ok  " : applied ? "HOLE" : "BLOCKED(unexpected)";
  console.log(`  ${verdict}  ${name}${error ? "  [" + error.message.slice(0, 60) + "]" : ""}`);
  return applied;
};

console.log("SHOULD be allowed (this is what 'edit request' needs):");
await probe("edit description", { description: "edited by the customer" }, true);
await probe("edit title", { title: "edited title" }, true);
await probe("change city", { city_id: city.id }, true);

console.log("\nShould NOT be allowed:");
await probe("mark the job completed", { status: "completed" }, false);
await probe("set a final price", { final_price: 1 }, false);
await probe("zero out the commission", { commission: 0 }, false);
// must differ from the stored value, or "is distinct from" is false and the
// update is a legitimate no-op rather than a write
await probe("change the platform's service fee", { service_fee: 999 }, false);
await probe("change the trade after sending", { category_id: 2 }, false);
await probe("change urgency (restamps the fee)", { urgency: "same_day" }, false);
await probe("assign an arbitrary professional", { professional_id: uid }, false);
await probe("set the agreed price range", { price_min: 1, price_max: 2 }, false);

await db.from("bookings").delete().eq("id", bk.id);
console.log("\ncleaned up.");
console.log(holes === 0 ? "RESULT: no holes" : `RESULT: ${holes} column(s) a customer can write that they should not`);
process.exit(0);

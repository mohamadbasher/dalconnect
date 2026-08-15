// Customer-side "confirm work is done" (migration 20260714000009).
//
// Verifies the new allowed transition (on_the_way/in_progress -> completed,
// customer-initiated) without opening any new hole: money fields must stay
// untouched, and every OTHER status the customer could try must still be
// refused. Uses the REAL assignment path (an offer + accept_offer) rather
// than faking professional_id, since that assignment only ever happens
// through the trusted RPC — a raw update trying to shortcut it is correctly
// blocked by RLS itself, which the first version of this script mistook for a
// bug in the new migration.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../mobile/.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const anon = () => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

const customer = anon();
const { data: cAuth, error: cErr } = await customer.auth.signInWithPassword({
  email: "0501111111@phone.dalconnect.app", password: "123456",
});
if (cErr) { console.error("customer sign-in failed:", cErr.message); process.exit(1); }
const uid = cAuth.user.id;

const pro = anon();
const { data: pAuth, error: pErr } = await pro.auth.signInWithPassword({
  email: "000001@pro.dalconnect.app", password: "123456",
});
if (pErr) { console.error("pro sign-in failed:", pErr.message); process.exit(1); }

const { data: cat } = await customer.from("categories").select("id").eq("slug", "electrician").single();
const { data: city } = await customer.from("cities").select("id").limit(1).single();

const mk = async () => {
  const { data, error } = await customer.from("bookings").insert({
    type: "open", status: "open", customer_id: uid, category_id: cat.id,
    title: "completion test", description: "throwaway row for a permission check",
    photos: [], city_id: city.id, address: "", urgency: "scheduled",
  }).select("*").single();
  if (error) throw error;
  return data;
};
const cleanup = (id) => customer.from("bookings").delete().eq("id", id);

/** the real path: pro quotes, customer accepts — this is what actually assigns professional_id */
const assign = async (bookingId) => {
  const { data: offer, error: offErr } = await pro.from("offers").insert({
    booking_id: bookingId, professional_id: pAuth.user.id,
    price_min: 120, price_max: 200, eta_minutes: 30, status: "pending",
  }).select("id").single();
  if (offErr) throw offErr;
  const { error: accErr } = await customer.rpc("accept_offer", { p_offer_id: offer.id });
  if (accErr) throw accErr;
};

/** advance status the way job/[id].tsx does — as the now-assigned professional */
const advance = async (bookingId, status) => {
  const { data, error } = await pro.from("bookings").update({ status }).eq("id", bookingId).select("id");
  if (error || !data?.length) throw new Error(error?.message ?? `advance to ${status} affected 0 rows`);
};

console.log("1. Too early — customer cannot confirm completion before work starts");
for (const [label, setup] of [
  ["open", async (bk) => {}],
  ["accepted", async (bk) => assign(bk.id)],
]) {
  const bk = await mk();
  await setup(bk);
  const { data, error } = await customer.from("bookings").update({ status: "completed" }).eq("id", bk.id).select("id");
  const blocked = !!error || !data?.length;
  check(`blocked from '${label}'`, blocked, error?.message?.slice(0, 60) ?? (blocked ? "(0 rows)" : "(HOLE — succeeded)"));
  await cleanup(bk.id);
}

console.log("\n2. The real path — on_the_way / in_progress -> completed, customer-initiated");
for (const from of ["on_the_way", "in_progress"]) {
  const bk = await mk();
  await assign(bk.id);
  await advance(bk.id, from);
  const { data, error } = await customer.from("bookings")
    .update({ status: "completed" }).eq("id", bk.id).select("status, final_price, price, commission");
  check(`customer confirms from '${from}'`, !error && data?.[0]?.status === "completed", error?.message?.slice(0, 60) ?? "");
  await cleanup(bk.id);
}

console.log("\n3. Still money-safe — customer cannot sneak a price in with the confirmation");
{
  const bk = await mk();
  await assign(bk.id);
  await advance(bk.id, "in_progress");
  const { data, error } = await customer.from("bookings")
    .update({ status: "completed", final_price: 5 }).eq("id", bk.id).select("id");
  check("final_price rejected even alongside a valid status change", !!error, error?.message?.slice(0, 60) ?? "(HOLE)");
  await cleanup(bk.id);
}

console.log("\n4. Commission falls back to price_min when the customer confirms without a professional-set final_price");
{
  const bk = await mk();
  await assign(bk.id); // price_min=120 from the offer
  await advance(bk.id, "in_progress");
  await customer.from("bookings").update({ status: "completed" }).eq("id", bk.id);
  const { data } = await customer.from("bookings").select("final_price, price, price_min, commission").eq("id", bk.id).single();
  check("basis defaulted to price_min (120)", Number(data.price) === 120, JSON.stringify(data));
  await cleanup(bk.id);
}

console.log("\n5. Regression — cancelling is unaffected");
{
  const bk = await mk();
  const { error: okErr } = await customer.from("bookings").update({ status: "cancelled" }).eq("id", bk.id);
  check("cancel from open still allowed", !okErr, okErr?.message ?? "");
  await cleanup(bk.id);
}
{
  const bk = await mk();
  await assign(bk.id);
  await advance(bk.id, "on_the_way");
  const { data, error } = await customer.from("bookings").update({ status: "cancelled" }).eq("id", bk.id).select("id");
  check("cancel from on_the_way still blocked", !!error || !data?.length, error?.message?.slice(0, 60) ?? "(HOLE)");
  await cleanup(bk.id);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

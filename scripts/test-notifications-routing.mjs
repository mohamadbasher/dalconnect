// Who gets told what (migration 20260714000018).
//
// A customer accepted a quote and the professional was never told — the
// customer got "your request was approved", which they already knew, having
// just tapped it. This walks a whole job and asserts each message lands on the
// party that did NOT cause the change. Run from mobile/.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const readEnv = (rel) => {
  try {
    return Object.fromEntries(
      readFileSync(new URL(rel, import.meta.url), "utf8")
        .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
    );
  } catch { return {}; }
};
const env = { ...readEnv("../admin/.env.local"), ...readEnv("../mobile/.env") };
env.SUPABASE_SERVICE_ROLE_KEY = readEnv("../admin/.env.local").SUPABASE_SERVICE_ROLE_KEY;
const anon = () => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const svc = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`  ${ok ? "OK  " : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

const cust = anon();
const { data: c } = await cust.auth.signInWithPassword({ email: "0501111111@phone.dalconnect.app", password: "123456" });
const cid = c.user.id;
const pro = anon();
const { data: p } = await pro.auth.signInWithPassword({ email: "000001@pro.dalconnect.app", password: "123456" });
const pid = p.user.id;

const { data: cat } = await cust.from("categories").select("id").eq("slug", "electrician").single();
const { data: city } = await cust.from("cities").select("id").limit(1).single();

/**
 * Notifications for a user newer than a mark.
 *
 * The mark is the user's own latest row as the SERVER sees it, not
 * `new Date()`. An earlier version used the client clock and reported every
 * check as "(nothing)" — this machine's clock runs about a minute ahead of the
 * database, so the filter excluded rows that had just been written. Comparing
 * server timestamps against server timestamps removes the question.
 */
const markFor = async (uid) => {
  const { data } = await svc.from("notifications")
    .select("created_at").eq("user_id", uid)
    .order("created_at", { ascending: false }).limit(1);
  return data?.[0]?.created_at ?? "1970-01-01T00:00:00Z";
};
const since = async (uid, mark) => {
  const { data } = await svc.from("notifications")
    .select("title_he, created_at").eq("user_id", uid).gt("created_at", mark)
    .order("created_at", { ascending: false });
  return data ?? [];
};

const { data: bk } = await cust.from("bookings").insert({
  type: "open", status: "open", customer_id: cid, category_id: cat.id,
  title: "notification routing probe", description: "checks who gets told what",
  photos: [], city_id: city.id, address: "", urgency: "scheduled",
}).select("id").single();

const { data: offer } = await pro.from("offers").insert({
  booking_id: bk.id, professional_id: pid, price_min: 100, price_max: 200, eta_minutes: 30, status: "pending",
}).select("id").single();

console.log("1. Customer accepts a quote — the PROFESSIONAL is the one who needs to know");
{
  const markPro = await markFor(pid);
  const markCust = await markFor(cid);
  const { error } = await cust.rpc("accept_offer", { p_offer_id: offer.id });
  if (error) { console.error("accept failed:", error.message); process.exit(1); }
  await new Promise((r) => setTimeout(r, 700));
  const toPro = await since(pid, markPro);
  const toCust = await since(cid, markCust);
  check("professional is notified they won the job", toPro.length > 0, toPro[0]?.title_he ?? "(nothing)");
  check("customer is NOT told what they just did", toCust.length === 0, toCust[0]?.title_he ?? "");
}

console.log("\n2. Professional says they're on the way — the CUSTOMER needs to know");
{
  const markPro = await markFor(pid);
  const markCust = await markFor(cid);
  await pro.from("bookings").update({ status: "on_the_way" }).eq("id", bk.id);
  await new Promise((r) => setTimeout(r, 700));
  const toCust = await since(cid, markCust);
  const toPro = await since(pid, markPro);
  check("customer is notified", toCust.length > 0, toCust[0]?.title_he ?? "(nothing)");
  check("professional is not told what they just did", toPro.length === 0, toPro[0]?.title_he ?? "");
}

console.log("\n3. CUSTOMER confirms completion — the professional should hear it");
{
  const markPro = await markFor(pid);
  const markCust = await markFor(cid);
  const { error } = await cust.from("bookings").update({ status: "completed" }).eq("id", bk.id);
  check("customer may confirm completion", !error, error?.message?.slice(0, 45) ?? "");
  await new Promise((r) => setTimeout(r, 700));
  const toPro = await since(pid, markPro);
  const toCust = await since(cid, markCust);
  check("professional is told the customer closed it", toPro.length > 0, toPro[0]?.title_he ?? "(nothing)");
  check("customer is not told what they just did", toCust.length === 0, toCust[0]?.title_he ?? "");
}

console.log("\n4. A declined quote tells the professional");
{
  const { data: bk2 } = await cust.from("bookings").insert({
    type: "open", status: "open", customer_id: cid, category_id: cat.id,
    title: "decline probe", description: "checks the decline notification",
    photos: [], city_id: city.id, address: "", urgency: "scheduled",
  }).select("id").single();
  const { data: o2 } = await pro.from("offers").insert({
    booking_id: bk2.id, professional_id: pid, price_min: 50, price_max: 90, status: "pending",
  }).select("id").single();

  const markPro = await markFor(pid);
  const markCust = await markFor(cid);
  const { error } = await cust.rpc("decline_offer", { p_offer_id: o2.id });
  check("decline succeeds", !error, error?.message?.slice(0, 45) ?? "");
  await new Promise((r) => setTimeout(r, 700));
  const toPro = await since(pid, markPro);
  check("professional is told their quote wasn't chosen", toPro.length > 0, toPro[0]?.title_he ?? "(nothing)");
  await svc.from("offers").delete().eq("booking_id", bk2.id);
  await svc.from("bookings").delete().eq("id", bk2.id);
}

await svc.from("offers").delete().eq("booking_id", bk.id);
await svc.from("transactions").delete().eq("booking_id", bk.id);
await svc.from("bookings").delete().eq("id", bk.id);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

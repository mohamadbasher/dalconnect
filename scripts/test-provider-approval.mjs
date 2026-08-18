// A provider cannot work until an admin approves them (migration …0017).
//
// Creates a REAL provider account through the app's own signup path, then
// checks it can do nothing until approved — and everything after. Blocking
// only one of the three routes would leave the others as the way round, so all
// three are asserted: seeing open work, quoting on it, and being notified.
// Run from mobile/.
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
// The service-role key belongs to the admin panel, never the app — this test
// only needs it to tear down the throwaway account it creates.
const env = { ...readEnv("../admin/.env.local"), ...readEnv("../mobile/.env") };
env.SUPABASE_SERVICE_ROLE_KEY = readEnv("../admin/.env.local").SUPABASE_SERVICE_ROLE_KEY;
const anon = () => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const svc = env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`  ${ok ? "OK  " : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

// a throwaway provider, created the way the app creates one
const stamp = String(Date.now()).slice(-6);
const providerNo = stamp;
const newPro = anon();
const { data: su, error: suErr } = await newPro.auth.signUp({
  email: `${providerNo}@pro.dalconnect.app`,
  password: "123456",
  options: {
    data: {
      full_name: "مهني تحت المراجعة", phone: `05${stamp}0`, lang: "ar",
      role: "professional", provider_no: providerNo, business_name: "ورشة الاختبار",
    },
  },
});
if (suErr) { console.error("provider signup failed:", suErr.message); process.exit(1); }
const proId = su.user.id;

const admin = anon();
await admin.auth.signInWithPassword({ email: "0503333333@phone.dalconnect.app", password: "123456" });

const customer = anon();
const { data: c } = await customer.auth.signInWithPassword({ email: "0501111111@phone.dalconnect.app", password: "123456" });
const cid = c.user.id;

const { data: cat } = await customer.from("categories").select("id").eq("slug", "electrician").single();
const { data: city } = await customer.from("cities").select("id").limit(1).single();

// the new provider covers the trade, so only approval separates them from work
if (svc) await svc.from("professional_categories").insert({ professional_id: proId, category_id: cat.id });
else console.log("  (no service-role key — category link skipped)");

console.log("1. A brand-new provider starts unapproved");
{
  const { data } = await newPro.from("professionals").select("verification_status").eq("id", proId).single();
  check("verification_status is 'pending'", data?.verification_status === "pending", data?.verification_status);
}

// a live open request in their trade
const { data: bk } = await customer.from("bookings").insert({
  type: "open", status: "open", customer_id: cid, category_id: cat.id,
  title: "approval gate probe", description: "a request an unapproved provider must not see",
  photos: [], city_id: city.id, address: "", urgency: "scheduled",
}).select("id").single();

console.log("\n2. Unapproved: can do nothing");
{
  const { data } = await newPro.from("bookings").select("id").eq("id", bk.id);
  check("cannot see the open request", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`);
}
{
  const { error } = await newPro.from("offers").insert({
    booking_id: bk.id, professional_id: proId, price_min: 100, price_max: 200, message: "let me in",
  });
  check("cannot send a quote", !!error, error?.message?.slice(0, 55) ?? "QUOTED ANYWAY");
}
{
  const { count } = await newPro.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", proId);
  check("was not notified about it", (count ?? 0) === 0, `${count ?? 0} notification(s)`);
}

console.log("\n3. Admin approves");
{
  const { error } = await admin.from("professionals").update({ verification_status: "approved" }).eq("id", proId);
  check("admin can approve", !error, error?.message?.slice(0, 55) ?? "");
}

console.log("\n4. Approved: can work");
{
  const { data } = await newPro.from("bookings").select("id").eq("id", bk.id);
  check("now sees the open request", (data?.length ?? 0) === 1, `saw ${data?.length ?? 0}`);
}
{
  const { error } = await newPro.from("offers").insert({
    booking_id: bk.id, professional_id: proId, price_min: 100, price_max: 200, message: "happy to help",
  });
  check("now can send a quote", !error, error?.message?.slice(0, 55) ?? "");
}
{
  // a second request should now reach them
  const { data: bk2 } = await customer.from("bookings").insert({
    type: "open", status: "open", customer_id: cid, category_id: cat.id,
    title: "second probe", description: "an approved provider should hear about this one",
    photos: [], city_id: city.id, address: "", urgency: "scheduled",
  }).select("id").single();
  await new Promise((r) => setTimeout(r, 800));
  const { count } = await newPro.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", proId);
  check("now gets notified of new work", (count ?? 0) > 0, `${count ?? 0} notification(s)`);
  if (svc) await svc.from("bookings").delete().eq("id", bk2.id);
}

console.log("\n5. A rejected provider is shut out again");
{
  await admin.from("professionals").update({ verification_status: "rejected" }).eq("id", proId);
  const { data } = await newPro.from("bookings").select("id").eq("id", bk.id);
  check("rejected loses sight of open work", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`);
  const { error } = await newPro.from("offers").insert({
    booking_id: bk.id, professional_id: proId, price_min: 1, price_max: 2, message: "again",
  });
  check("rejected cannot quote", !!error, error?.message?.slice(0, 50) ?? "QUOTED ANYWAY");
}

// clean up
if (svc) {
  await svc.from("offers").delete().eq("professional_id", proId);
  await svc.from("bookings").delete().eq("id", bk.id);
  await svc.from("professional_categories").delete().eq("professional_id", proId);
  await svc.from("professionals").delete().eq("id", proId);
  await svc.auth.admin.deleteUser(proId);
  console.log("\ncleaned up the throwaway provider.");
} else {
  console.log(`\nNOTE: no service-role key — throwaway provider ${providerNo} left behind.`);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

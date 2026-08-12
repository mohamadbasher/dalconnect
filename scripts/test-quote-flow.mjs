// End-to-end test of the request-and-quote model against the live backend.
// customer posts a same-day request -> two electricians quote a range ->
// customer declines one, accepts the other -> phone is revealed only after
// acceptance -> job completes -> commission is computed from the final price.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "../mobile/node_modules/@supabase/supabase-js/dist/index.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const readEnv = (p) =>
  Object.fromEntries(
    readFileSync(join(root, p), "utf-8")
      .split("\n").filter((l) => l.includes("=")).map((l) => {
        const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
const env = readEnv("mobile/.env");
const adminEnv = readEnv("admin/.env.local");
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL, adminEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  OK  " + m)) : (fail++, console.log("  FAIL " + m)));
const client = () => createClient(URL, ANON, { auth: { persistSession: false } });
/** Providers sign in with their six-digit number, customers with their phone. */
const signInProvider = async (providerNo) => {
  const c = client();
  const { error } = await c.auth.signInWithPassword({
    email: `${providerNo}@pro.dalconnect.app`, password: "123456",
  });
  if (error) throw new Error(`sign in provider ${providerNo}: ${error.message}`);
  return c;
};

// throwaway customer
const phone = "0507" + String(Date.now()).slice(-6);
const cust = client();
const { data: su, error: suErr } = await cust.auth.signUp({
  email: `${phone}@phone.dalconnect.app`, password: "123456",
  options: { data: { full_name: "زبون الاختبار", phone, lang: "ar" } },
});
if (suErr) { console.error("signup failed:", suErr.message); process.exit(1); }
const custId = su.user.id;

try {
  const proA = await signInProvider("000001"); // كهرباء أبو يوسف (0521000001)
  const proB = await signInProvider("222222"); // خدمات المدينة   (0502222222)
  const { data: proAu } = await proA.auth.getUser();
  const { data: proBu } = await proB.auth.getUser();

  const { data: cat } = await admin.from("categories").select("id").eq("slug", "electrician").single();

  console.log("1. Customer posts a SAME-DAY request (no pro chosen)");
  const { data: bk, error: bkErr } = await cust.from("bookings").insert({
    type: "open", status: "open", customer_id: custId, category_id: cat.id,
    urgency: "same_day", title: "لا يوجد كهرباء",
    description: "انقطعت الكهرباء في المطبخ بشكل كامل ولا تعمل القواطع",
    address: "شارع الاختبار 5",
  }).select("*").single();
  ok(!bkErr && bk?.status === "open" && bk?.urgency === "same_day",
     `request created, urgency=${bk?.urgency}, fee stamped=${bk?.service_fee} ${bkErr ? "- " + bkErr.message : ""}`);

  console.log("2. Phone is NOT revealed while the request is still open");
  {
    const { data } = await cust.rpc("get_contact_phone", { p_booking_id: bk.id });
    ok(data === null, `contact withheld before acceptance (got ${JSON.stringify(data)})`);
  }

  console.log("3. Both electricians see it and quote a RANGE");
  const { data: o1, error: e1 } = await proA.from("offers").insert({
    booking_id: bk.id, professional_id: proAu.user.id,
    price_min: 250, price_max: 400, eta_minutes: 60, message: "أصل خلال ساعة ومعي قطع الغيار",
  }).select("*").single();
  const { data: o2, error: e2 } = await proB.from("offers").insert({
    booking_id: bk.id, professional_id: proBu.user.id,
    price_min: 300, price_max: 350, eta_minutes: 120, message: "متاح بعد ساعتين",
  }).select("*").single();
  ok(!e1 && !e2 && o1?.price_min == 250 && o2?.price_max == 350,
     `two quotes stored as ranges ${e1?.message ?? ""}${e2?.message ?? ""}`);

  console.log("4. Customer sees both quotes with the pro behind them");
  {
    const { data: offers } = await cust
      .from("offers")
      .select("*, professional:professionals(business_name, rating_avg, jobs_completed)")
      .eq("booking_id", bk.id);
    ok((offers?.length ?? 0) === 2 && offers.every((o) => o.professional?.business_name),
       `sees ${offers?.length} quotes: ` +
       (offers ?? []).map((o) => `${o.professional?.business_name} ₪${o.price_min}-${o.price_max}`).join(" | "));
  }

  console.log("5. Customer DECLINES one quote — request stays open");
  {
    const { error } = await cust.rpc("decline_offer", { p_offer_id: o2.id });
    const { data: after } = await admin.from("offers").select("status").eq("id", o2.id).single();
    const { data: b2 } = await admin.from("bookings").select("status").eq("id", bk.id).single();
    ok(!error && after.status === "rejected" && b2.status === "open",
       `quote declined (offer=${after?.status}, booking still ${b2?.status}) ${error?.message ?? ""}`);
  }

  console.log("6. Customer ACCEPTS the other quote");
  {
    const { error } = await cust.rpc("accept_offer", { p_offer_id: o1.id });
    const { data: b3 } = await admin.from("bookings")
      .select("status, professional_id, price_min, price_max").eq("id", bk.id).single();
    ok(!error && b3.status === "accepted" && b3.professional_id === proAu.user.id
       && Number(b3.price_min) === 250 && Number(b3.price_max) === 400,
       `accepted -> pro assigned, range ₪${b3?.price_min}-${b3?.price_max} ${error?.message ?? ""}`);
  }

  console.log("7. Phone IS revealed now — to both parties, not to strangers");
  {
    const { data: forCust } = await cust.rpc("get_contact_phone", { p_booking_id: bk.id });
    const { data: forPro } = await proA.rpc("get_contact_phone", { p_booking_id: bk.id });
    const { error: strangerErr } = await proB.rpc("get_contact_phone", { p_booking_id: bk.id });
    ok(forCust === "0521000001" && forPro === phone && !!strangerErr,
       `customer got pro's phone, pro got customer's, outsider blocked (${strangerErr ? "blocked" : "NOT BLOCKED"})`);
  }

  console.log("8. Job completes with the final agreed price -> commission");
  {
    await proA.from("bookings").update({ status: "on_the_way" }).eq("id", bk.id);
    await proA.from("bookings").update({ status: "in_progress" }).eq("id", bk.id);
    const { error } = await proA.from("bookings")
      .update({ status: "completed", final_price: 320 }).eq("id", bk.id);
    const { data: b4 } = await admin.from("bookings").select("status, final_price, commission").eq("id", bk.id).single();
    const { data: tx } = await admin.from("transactions").select("amount, commission, net").eq("booking_id", bk.id).maybeSingle();
    ok(!error && Number(b4.commission) === 32 && tx && Number(tx.net) === 288,
       `final ₪${b4?.final_price} -> commission ₪${b4?.commission}, pro nets ₪${tx?.net} ${error?.message ?? ""}`);
  }

  console.log("9. Customer rates the professional");
  {
    const { error } = await cust.from("reviews").insert({
      booking_id: bk.id, customer_id: custId, professional_id: proAu.user.id, rating: 5,
    });
    const { data: b5 } = await admin.from("bookings").select("status").eq("id", bk.id).single();
    ok(!error && b5.status === "rated", `rated -> booking ${b5?.status} ${error?.message ?? ""}`);
  }

  await admin.from("bookings").delete().eq("id", bk.id);
} catch (e) {
  fail++;
  console.log("  FAIL exception:", e.message);
} finally {
  await admin.auth.admin.deleteUser(custId).catch(() => {});
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

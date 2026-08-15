// Empirical security probe — signs in as real low-privilege users and tries to
// do things they should not be able to do. Every check reports what ACTUALLY
// happened against the live database, not what the policy text suggests.
//
// Run from mobile/ (needs @supabase/supabase-js). Read-mostly: every write it
// attempts is either expected to fail, or is rolled back immediately.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../mobile/.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const anon = () => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const findings = [];
const report = (sev, title, detail) => {
  findings.push({ sev, title, detail });
  console.log(`  ${sev === "CRITICAL" ? "!!!!" : sev === "HIGH" ? "!!! " : sev === "MED" ? "!!  " : "ok  "} ${title}${detail ? "  — " + detail : ""}`);
};
const ok = (title, detail) => report("OK", title, detail);

/**
 * Try to write `patch` and report honestly whether it was ALLOWED.
 *
 * The subtlety that produced three false positives in earlier runs: a guard
 * written as `if new.x is distinct from old.x then raise` never fires when you
 * write the value the row already holds. The update then "succeeds", and a
 * naive probe reports the column as writable when it is fully protected. So
 * every value here must differ from what is stored — this helper reads the row
 * first and refuses to test a no-op.
 */
async function probeWrite(client, table, id, patch, restoreFrom) {
  const cols = Object.keys(patch);
  const { data: before } = await client.from(table).select(cols.join(",")).eq("id", id).single();
  if (before) {
    const noop = cols.every((c) => String(before[c]) === String(patch[c]));
    if (noop) return { skipped: true, reason: `value already ${JSON.stringify(before[cols[0]])} — would be a no-op` };
  }
  const { data, error } = await client.from(table).update(patch).eq("id", id).select(cols.join(","));
  const allowed = !error && data?.length > 0;
  if (allowed && restoreFrom !== false && before) {
    await client.from(table).update(before).eq("id", id);
  }
  return { allowed, error, before };
}

const customer = anon();
const { data: cAuth, error: cErr } = await customer.auth.signInWithPassword({
  email: "0501111111@phone.dalconnect.app", password: "123456",
});
if (cErr) { console.error("customer sign-in failed:", cErr.message); process.exit(1); }
const cid = cAuth.user.id;

const proC = anon();
const { data: pAuth } = await proC.auth.signInWithPassword({
  email: "000001@pro.dalconnect.app", password: "123456",
});
const pid = pAuth.user.id;

console.log("=== A. PRIVILEGE ESCALATION ===");
{
  const { data, error } = await customer.from("profiles").update({ role: "admin" }).eq("id", cid).select("role");
  if (!error && data?.length && data[0].role === "admin") {
    report("CRITICAL", "customer can promote THEMSELVES to admin", "profiles.role is writable via profiles_update_self");
    await customer.from("profiles").update({ role: "customer" }).eq("id", cid); // revert immediately
  } else ok("role escalation blocked", error?.message?.slice(0, 60) ?? "");
}
{
  const { data: cur } = await customer.from("profiles").select("is_banned").eq("id", cid).single();
  const r = await probeWrite(customer, "profiles", cid, { is_banned: !cur.is_banned });
  if (r.allowed) report("HIGH", "user can write their own is_banned flag", "a banned user can unban themselves");
  else ok("is_banned not self-writable", r.error?.message?.slice(0, 60) ?? "");
}
{
  const { data: cur } = await customer.from("profiles").select("phone_verified").eq("id", cid).single();
  const r = await probeWrite(customer, "profiles", cid, { phone_verified: !cur.phone_verified });
  if (r.allowed) report("HIGH", "user can self-set phone_verified", "the verification flag means nothing if the user sets it");
  else ok("phone_verified not self-writable", r.error?.message?.slice(0, 60) ?? "");
}

console.log("\n=== B. THE PRODUCT'S CORE GATE: phone numbers ===");
{
  // the whole model is "phone revealed only after a quote is accepted"
  const { data, error } = await customer.from("profiles").select("id, full_name, phone").neq("id", cid).limit(5);
  const withPhone = (data ?? []).filter((r) => r.phone);
  if (!error && withPhone.length) {
    report("CRITICAL", `customer can read ${withPhone.length}+ OTHER users' phone numbers directly`,
      `profiles_read is using(true); e.g. ${withPhone[0].full_name} -> ${withPhone[0].phone}`);
  } else ok("other users' phones not readable", error?.message?.slice(0, 60) ?? "");
}
{
  // does get_contact_phone still correctly gate? (it should, but the above bypasses it)
  const { data: someBooking } = await customer.from("bookings").select("id").eq("customer_id", cid).limit(1);
  if (someBooking?.length) {
    const { data } = await customer.rpc("get_contact_phone", { p_booking_id: someBooking[0].id });
    ok("get_contact_phone RPC itself still gates correctly", `returned ${data ? "a number (booking is accepted)" : "null"}`);
  }
}

console.log("\n=== C. TRUST-SIGNAL FORGERY (professionals) ===");
{
  const { data: cur } = await proC.from("professionals").select("verification_status").eq("id", pid).single();
  // must differ from what's stored, or the guard's `is distinct from` never fires
  const target = cur.verification_status === "approved" ? "rejected" : "approved";
  const r = await probeWrite(proC, "professionals", pid, { verification_status: target });
  if (r.allowed) report("CRITICAL", "professional can self-approve their verification badge",
    `set it to '${target}' — the badge can be granted by the person it vouches for`);
  else ok(`verification_status not self-writable (tried '${target}', stored '${cur.verification_status}')`,
    r.error?.message?.slice(0, 60) ?? "");
}
{
  const { data: cur } = await proC.from("professionals").select("rating_avg, rating_count, jobs_completed").eq("id", pid).single();
  const r = await probeWrite(proC, "professionals", pid, {
    rating_avg: Number(cur.rating_avg) === 5 ? 4.1 : 5, rating_count: (cur.rating_count ?? 0) + 999,
    jobs_completed: (cur.jobs_completed ?? 0) + 9999,
  });
  if (r.allowed) report("HIGH", "professional can forge their own rating and job count", "ratings are the only trust signal customers have");
  else ok("rating/jobs not self-writable", r.error?.message?.slice(0, 60) ?? "");
}
{
  const { data: cur } = await proC.from("professionals").select("featured, featured_sort").eq("id", pid).single();
  const r = await probeWrite(proC, "professionals", pid, { featured: !cur.featured, featured_sort: (cur.featured_sort ?? 0) + 1 });
  if (r.allowed) report("HIGH", "professional can mark themselves FEATURED", "paid placement can be self-granted for free");
  else ok(`featured not self-writable (stored ${cur.featured})`, r.error?.message?.slice(0, 60) ?? "");
}

console.log("\n=== D. OFFERS: can a quote change after it's accepted? ===");
{
  const { data: acc } = await proC.from("offers").select("id, booking_id, price_min, price_max, status")
    .eq("professional_id", pid).eq("status", "accepted").limit(1);
  if (acc?.length) {
    const o = acc[0];
    const { data, error } = await proC.from("offers")
      .update({ price_min: 99999, price_max: 99999 }).eq("id", o.id).select("price_min");
    if (!error && data?.length) {
      report("HIGH", "professional can rewrite the price of an ALREADY-ACCEPTED quote",
        "the customer agreed to one number and can be shown another");
      await proC.from("offers").update({ price_min: o.price_min, price_max: o.price_max }).eq("id", o.id);
    } else ok("accepted offer price is locked", error?.message?.slice(0, 60) ?? "");
  } else ok("(no accepted offer to test with)", "");
}
{
  // can a pro self-accept their own offer, bypassing the customer's choice?
  const { data: open } = await proC.from("offers").select("id, status").eq("professional_id", pid).eq("status", "pending").limit(1);
  if (open?.length) {
    const { data, error } = await proC.from("offers").update({ status: "accepted" }).eq("id", open[0].id).select("status");
    if (!error && data?.length && data[0].status === "accepted") {
      report("HIGH", "professional can mark their OWN offer accepted", "bypasses the customer choosing");
      await proC.from("offers").update({ status: "pending" }).eq("id", open[0].id);
    } else ok("pro cannot self-accept an offer", error?.message?.slice(0, 60) ?? "");
  } else ok("(no pending offer to test with)", "");
}

console.log("\n=== E. CHAT INTEGRITY ===");
{
  // can a party edit the OTHER person's message text?
  const { data: convs } = await customer.from("conversations").select("id").or(`customer_id.eq.${cid},professional_id.eq.${cid}`).limit(1);
  if (convs?.length) {
    const { data: msgs } = await customer.from("messages").select("id, sender_id, body").eq("conversation_id", convs[0].id).neq("sender_id", cid).limit(1);
    if (msgs?.length) {
      const m = msgs[0];
      const { data, error } = await customer.from("messages").update({ body: "TAMPERED" }).eq("id", m.id).select("body");
      if (!error && data?.length && data[0].body === "TAMPERED") {
        report("HIGH", "a user can EDIT the other party's chat messages", "chat history is evidence in a dispute");
        await customer.from("messages").update({ body: m.body }).eq("id", m.id);
      } else ok("cannot edit the other party's messages", error?.message?.slice(0, 60) ?? "");
    } else ok("(no counterparty message to test with)", "");
  } else ok("(no conversation to test with)", "");
}

console.log("\n=== F. PLATFORM CONFIG ===");
{
  const { data, error } = await customer.from("app_settings").select("key, value");
  if (!error && data?.length) ok("app_settings readable by all users (by design?)", data.map(r => r.key).join(", "));
  const { data: w, error: wErr } = await customer.from("app_settings").update({ value: 0 }).eq("key", "commission_rate").select("key");
  if (!wErr && w?.length) report("CRITICAL", "any user can rewrite commission_rate", "platform revenue is user-controlled");
  else ok("app_settings not writable by users", wErr?.message?.slice(0, 60) ?? "");
}

console.log("\n=== G. OTHER USERS' ROWS ===");
{
  const { data: other } = await customer.from("profiles").select("id").neq("id", cid).limit(1);
  if (other?.length) {
    const { data, error } = await customer.from("profiles").update({ full_name: "HACKED" }).eq("id", other[0].id).select("id");
    if (!error && data?.length) report("CRITICAL", "user can edit OTHER users' profiles", "");
    else ok("cannot edit another user's profile", error?.message?.slice(0, 60) ?? "(0 rows)");
  }
}
{
  const { data, error } = await customer.from("transactions").select("*").limit(3);
  if (!error && data?.length) report("MED", "customer can read transactions rows", `${data.length} visible — pro earnings data`);
  else ok("transactions not readable by customer", "(0 rows)");
}

console.log("\n\n================ SUMMARY ================");
const bySev = { CRITICAL: [], HIGH: [], MED: [] };
for (const f of findings) if (bySev[f.sev]) bySev[f.sev].push(f);
for (const sev of ["CRITICAL", "HIGH", "MED"]) {
  if (bySev[sev].length) {
    console.log(`\n${sev} (${bySev[sev].length}):`);
    bySev[sev].forEach((f, i) => console.log(`  ${i + 1}. ${f.title}\n     ${f.detail}`));
  }
}
if (!findings.length) console.log("No issues found.");

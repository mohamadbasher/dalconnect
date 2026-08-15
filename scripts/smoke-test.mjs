// End-to-end smoke test against the live Supabase backend.
// Reads creds from mobile/.env (never hardcoded). Exercises signup -> profile
// trigger -> RLS-protected reads, then cleans the test user up via the admin API.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "../mobile/node_modules/@supabase/supabase-js/dist/index.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dirname, "..", "mobile", ".env"), "utf-8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, anon, { auth: { persistSession: false } });

const phone = "0509" + String(Date.now()).slice(-6);
const email = phone.replace(/\D/g, "") + "@phone.dalconnect.app";
const password = "test-" + Math.random().toString(36).slice(2, 10);
let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ✅ " + m)) : (fail++, console.log("  ❌ " + m)));

console.log("1. Public read of categories (RLS: readable by all)");
{
  const { data, error } = await supabase.from("categories").select("id,slug,name_ar,name_he").limit(50);
  ok(!error && data?.length === 32, `read ${data?.length ?? 0}/32 categories ${error ? "- " + error.message : ""}`);
}

console.log("2. Sign up a customer (synthetic phone email)");
let userId = null;
{
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: "سمير التجريبي", phone, lang: "ar" } },
  });
  userId = data?.user?.id ?? null;
  ok(!error && !!data.session, `signed up + auto-session ${error ? "- " + error.message : ""}`);
}

console.log("3. handle_new_user trigger created a profile row");
{
  // profiles can no longer be read with select(*): migration 20260714000011
  // dropped the table-level grant so nobody can harvest phone numbers. Your own
  // row (phone included) comes from the definer RPC.
  const { data, error } = await supabase.rpc("get_my_profile").single();
  ok(!error && data?.role === "customer", `profile role=${data?.role} name=${data?.full_name} ${error ? "- " + error.message : ""}`);
}

console.log("4. RLS blocks self-promotion to admin");
{
  const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", userId);
  ok(!!error, `admin escalation correctly rejected ${error ? "(" + error.message.slice(0, 60) + ")" : "- WAS ALLOWED!"}`);
}

console.log("5. become_professional is NO LONGER callable by a customer");
{
  // Professionals register on their own track from the login screen (6-digit
  // provider number). Converting a customer account was withdrawn from the
  // product, and 20260714000010 revoked EXECUTE — from PUBLIC, not just from
  // anon/authenticated, since those two inherit the default PUBLIC grant and
  // revoking from them alone leaves the function just as callable.
  const { data: cats } = await supabase.from("categories").select("id").limit(2);
  const { error } = await supabase.rpc("become_professional", {
    p_business_name: "كهرباء سمير",
    p_bio: "خبرة 10 سنوات",
    p_category_ids: cats.map((c) => c.id),
  });
  ok(!!error, error ? `correctly refused (${error.message.slice(0, 55)})` : "- WAS ALLOWED: customers can still self-convert");
}

console.log("6. Create an open booking (self as customer)");
{
  const { data: cat } = await supabase.from("categories").select("id").eq("slug", "electrician").single();
  const { data, error } = await supabase.from("bookings").insert({
    type: "open", status: "open", customer_id: userId, category_id: cat.id,
    title: "اختبار", description: "طلب تجريبي للتأكد من عمل النظام", address: "شارع الاختبار",
  }).select("id,status").single();
  ok(!error && data?.status === "open", `open booking created ${error ? "- " + error.message : ""}`);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);

// cleanup via admin API (service role)
const service = process.env.SUPABASE_SERVICE_KEY;
if (service && userId) {
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.deleteUser(userId);
  console.log(error ? "cleanup: failed - " + error.message : "cleanup: test user deleted");
}
process.exit(fail > 0 ? 1 : 0);

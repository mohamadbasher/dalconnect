// Verifies the provider-account model against the live backend:
// one phone can hold BOTH a customer and a provider account, each with its own
// login identity (phone vs six-digit number).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "../mobile/node_modules/@supabase/supabase-js/dist/index.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const readEnv = (p) =>
  Object.fromEntries(
    readFileSync(join(root, p), "utf-8").split("\n").filter((l) => l.includes("=")).map((l) => {
      const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
  );
const env = readEnv("mobile/.env");
const adminEnv = readEnv("admin/.env.local");
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL, adminEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const c = () => createClient(URL, ANON, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const ok = (cond, m) => (cond ? (pass++, console.log("  OK  " + m)) : (fail++, console.log("  FAIL " + m)));

const PHONE = "0509" + String(Date.now()).slice(-6);   // one phone, two accounts
const PW = "123456";
const created = [];

try {
  console.log(`Phone under test: ${PHONE}`);

  console.log("1. Register a CUSTOMER on that phone");
  const cust = c();
  {
    const { data, error } = await cust.auth.signUp({
      email: `${PHONE}@phone.dalconnect.app`, password: PW,
      options: { data: { full_name: "زبون", phone: PHONE, lang: "ar" } },
    });
    if (data?.user) created.push(data.user.id);
    const { data: p } = await admin.from("profiles").select("role, provider_no").eq("id", data?.user?.id).single();
    ok(!error && p?.role === "customer" && p?.provider_no === null,
       `customer created (role=${p?.role}, provider_no=${p?.provider_no}) ${error?.message ?? ""}`);
  }

  console.log("2. Ask the server for a provider number for the SAME phone");
  let providerNo = null;
  {
    const anon = c();
    const { data: exists } = await anon.rpc("provider_exists_for_phone", { p_phone: PHONE });
    const { data: suggested, error } = await anon.rpc("suggest_provider_no", { p_phone: PHONE });
    providerNo = suggested;
    ok(!error && exists === false && suggested === PHONE.slice(-6),
       `no provider yet (exists=${exists}); suggested ${suggested} = last 6 of phone ${error?.message ?? ""}`);
  }

  console.log("3. Register a PROVIDER on the same phone");
  const pro = c();
  {
    const { data, error } = await pro.auth.signUp({
      email: `${providerNo}@pro.dalconnect.app`, password: PW,
      options: {
        data: { full_name: "مزوّد", phone: PHONE, lang: "ar",
                role: "professional", provider_no: providerNo, business_name: "ورشة الاختبار" },
      },
    });
    if (data?.user) created.push(data.user.id);
    const { data: p } = await admin.from("profiles").select("role, provider_no, phone").eq("id", data?.user?.id).single();
    const { data: prof } = await admin.from("professionals").select("business_name, verification_status").eq("id", data?.user?.id).maybeSingle();
    ok(!error && p?.role === "professional" && p?.provider_no === providerNo && prof?.verification_status === "pending",
       `provider created: no=${p?.provider_no}, business="${prof?.business_name}", status=${prof?.verification_status} ${error?.message ?? ""}`);
  }

  console.log("4. Both accounts coexist on the one phone");
  {
    const { data } = await admin.from("profiles").select("role").eq("phone", PHONE);
    const roles = (data ?? []).map((r) => r.role).sort().join("+");
    ok(roles === "customer+professional", `two accounts on ${PHONE}: ${roles}`);
  }

  console.log("5. Each identity logs into the RIGHT account");
  {
    const a = c();
    const { data: byPhone } = await a.auth.signInWithPassword({ email: `${PHONE}@phone.dalconnect.app`, password: PW });
    const { data: p1 } = await a.from("profiles").select("role").eq("id", byPhone?.user?.id).single();

    const b = c();
    const { data: byNo } = await b.auth.signInWithPassword({ email: `${providerNo}@pro.dalconnect.app`, password: PW });
    const { data: p2 } = await b.from("profiles").select("role").eq("id", byNo?.user?.id).single();

    ok(p1?.role === "customer" && p2?.role === "professional",
       `phone -> ${p1?.role}; number ${providerNo} -> ${p2?.role}`);
  }

  console.log("6. A second provider on the same phone is refused");
  {
    const anon = c();
    const { data: exists } = await anon.rpc("provider_exists_for_phone", { p_phone: PHONE });
    ok(exists === true, `provider_exists_for_phone now true (registration would be blocked)`);
  }

  console.log("7. Colliding last-6 digits fall back to a free number");
  {
    const anon = c();
    // a different phone ending in the SAME six digits as the one above
    const clashing = "053" + PHONE.slice(-7);
    const { data: suggested } = await anon.rpc("suggest_provider_no", { p_phone: clashing });
    ok(suggested && /^\d{6}$/.test(suggested) && suggested !== providerNo,
       `phone ${clashing} would end in ${clashing.slice(-6)} (taken) -> issued ${suggested}`);
  }
} catch (e) {
  fail++;
  console.log("  FAIL exception:", e.message);
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

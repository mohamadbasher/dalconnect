// Creates three demo accounts (customer, service provider, admin) sharing one
// password, so each role can be logged into for testing.
// Reads url + service key from admin/.env.local. Idempotent: re-running reuses
// existing users (matched by email) instead of erroring.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "../mobile/node_modules/@supabase/supabase-js/dist/index.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const env = Object.fromEntries(
  readFileSync(join(root, "admin", ".env.local"), "utf-8")
    .split("\n").filter((l) => l.includes("=")).map((l) => {
      const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const token = process.env.SUPABASE_TOKEN;
const ref = process.env.SUPABASE_REF;
if (!url || !service || !token || !ref) { console.error("missing env"); process.exit(1); }

const admin = createClient(url, service, { auth: { persistSession: false } });
const PASSWORD = process.env.DEMO_PASSWORD || "123456";
const toEmail = (phone) => `${phone.replace(/\D/g, "")}@phone.dalconnect.app`;

const users = [
  { role: "customer",     phone: "0501111111", name: "زبون تجريبي" },
  { role: "professional", phone: "0502222222", name: "مزوّد خدمة تجريبي" },
  { role: "admin",        phone: "0503333333", name: "مدير النظام" },
];

async function ensureUser(u) {
  const email = toEmail(u.phone);
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: u.name, phone: u.phone.replace(/\D/g, ""), lang: "ar" },
  });
  if (!error) return data.user.id;
  // already exists → find it, and reset the password so it matches
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = list.users.find((x) => x.email === email);
  if (!found) throw error;
  await admin.auth.admin.updateUserById(found.id, {
    password: PASSWORD, user_metadata: { full_name: u.name, phone: u.phone.replace(/\D/g, ""), lang: "ar" },
  });
  return found.id;
}

const ids = {};
for (const u of users) {
  ids[u.role] = await ensureUser(u);
  console.log(`✅ ${u.role.padEnd(13)} ${u.phone}  id=${ids[u.role].slice(0, 8)}…`);
}

// Set roles + professional data via raw SQL (session_replication_role bypasses
// the profile-protection trigger for this seed session).
const sql = `
set session_replication_role = replica;

update profiles set role='customer', full_name='زبون تجريبي', phone='0501111111',
  city_id=(select id from cities where name_he='חיפה' limit 1) where id='${ids.customer}';

update profiles set role='professional', full_name='مزوّد خدمة تجريبي', phone='0502222222',
  city_id=(select id from cities where name_he='נצרת' limit 1) where id='${ids.professional}';

insert into professionals (id, business_name, bio, city_id, is_available, verification_status, rating_avg, rating_count, jobs_completed)
values ('${ids.professional}', 'خدمات المدينة', 'كهرباء وتكييف وسباكة — خبرة أكثر من 10 سنوات في خدمة العملاء بجودة عالية.',
  (select id from cities where name_he='נצרת' limit 1), true, 'approved', 4.8, 12, 34)
on conflict (id) do update set business_name=excluded.business_name, bio=excluded.bio,
  city_id=excluded.city_id, is_available=true, verification_status='approved';

insert into professional_categories (professional_id, category_id)
select '${ids.professional}', id from categories where slug in ('electrician','ac','plumber')
on conflict do nothing;

update profiles set role='admin', full_name='مدير النظام', phone='0503333333' where id='${ids.admin}';

set session_replication_role = default;
`;

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
if (!res.ok) { console.error("SQL failed:", res.status, (await res.text()).slice(0, 800)); process.exit(1); }
console.log("✅ roles + professional profile applied");

// verify
const { data: check } = await admin.from("profiles").select("full_name,phone,role").in("id", Object.values(ids));
console.log("\nAccounts:");
for (const r of check) console.log(`  ${r.role.padEnd(13)} ${r.phone}  ${r.full_name}`);
console.log(`\nShared password: ${PASSWORD}`);

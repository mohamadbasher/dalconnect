// Seeds 8 realistic demo professionals (different trades/cities/ratings) so
// the marketplace looks alive during testing. Password for all: 123456.
// Idempotent — safe to re-run.
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
const token = process.env.SUPABASE_TOKEN, ref = process.env.SUPABASE_REF;
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = "123456";
const toEmail = (p) => `${p.replace(/\D/g, "")}@phone.dalconnect.app`;

const HOURS_FULL = { 0: { from: "08:00", to: "18:00" }, 1: { from: "08:00", to: "18:00" }, 2: { from: "08:00", to: "18:00" }, 3: { from: "08:00", to: "18:00" }, 4: { from: "08:00", to: "18:00" }, 5: { from: "08:00", to: "13:00" }, 6: null };
const HOURS_LATE = { 0: { from: "10:00", to: "21:00" }, 1: { from: "10:00", to: "21:00" }, 2: { from: "10:00", to: "21:00" }, 3: { from: "10:00", to: "21:00" }, 4: { from: "10:00", to: "21:00" }, 5: null, 6: { from: "10:00", to: "16:00" } };

const PROS = [
  { phone: "0521000001", name: "يوسف حاج", biz: "كهرباء أبو يوسف", bio: "كهربائي معتمد، خبرة 15 سنة. أعطال، لوحات كهرباء، إنارة ذكية. خدمة سريعة في نفس اليوم.", city: "נצרת", cats: ["electrician", "solar"], rating: 4.9, count: 23, jobs: 61, hours: HOURS_FULL, verified: true },
  { phone: "0521000002", name: "أمين مصاروة", biz: "سباكة الأمين", bio: "سباكة عامة وتسليك مجاري بأحدث المعدات. متوفر للطوارئ.", city: "אום אל-פחם", cats: ["plumber", "sewage"], rating: 4.7, count: 18, jobs: 44, hours: HOURS_FULL, verified: true },
  { phone: "0521000003", name: "سامي خلايلة", biz: "تكييف الشمال", bio: "تركيب وصيانة مكيفات جميع الأنواع. قطع غيار أصلية وكفالة على الشغل.", city: "סח׳נין", cats: ["ac", "appliance-repair"], rating: 4.8, count: 31, jobs: 87, hours: HOURS_FULL, verified: true },
  { phone: "0521000004", name: "سامر عزام", biz: "دهانات سامر", bio: "دهان شقق وفلل، جبس بورد وديكورات. ذوق عالي ونظافة بالشغل.", city: "טייבה", cats: ["painter", "gypsum"], rating: 4.6, count: 12, jobs: 29, hours: HOURS_LATE, verified: false },
  { phone: "0521000005", name: "خالد سواعد", biz: "نجارة الإتقان", bio: "نجارة عامة، مطابخ، خزائن حائط وتركيب أثاث. تفصيل حسب الطلب.", city: "שפרעם", cats: ["carpenter", "furniture-assembly"], rating: 4.9, count: 27, jobs: 52, hours: HOURS_FULL, verified: true },
  { phone: "0521000006", name: "نادر عثامنة", biz: "حدائق الجليل", bio: "تنسيق وصيانة حدائق، قص أشجار، شبكات ري أوتوماتيكية.", city: "עראבה", cats: ["gardening"], rating: 4.5, count: 9, jobs: 21, hours: HOURS_FULL, verified: false },
  { phone: "0521000007", name: "ليلى حداد", biz: "تنظيف البيت السعيد", bio: "تنظيف شقق ومكاتب، تنظيف عميق بعد الترميم. طاقم محترف وأسعار منافسة.", city: "חיפה", cats: ["cleaning"], rating: 4.7, count: 40, jobs: 113, hours: HOURS_LATE, verified: true },
  { phone: "0521000008", name: "محمد إغبارية", biz: "ميكانيكي محمد", bio: "ميكانيكا عامة، فحص قبل الشراء، خدمة سحب سيارات 24 ساعة.", city: "באקה אל-גרביה", cats: ["mechanic", "tow-truck"], rating: 4.8, count: 15, jobs: 38, hours: HOURS_FULL, verified: true },
];

async function ensureUser(p) {
  const { data, error } = await admin.auth.admin.createUser({
    email: toEmail(p.phone), password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: p.name, phone: p.phone, lang: "ar" },
  });
  if (!error) return data.user.id;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = list.users.find((x) => x.email === toEmail(p.phone));
  if (!found) throw error;
  return found.id;
}

let sql = "set session_replication_role = replica;\n";
for (const p of PROS) {
  const id = await ensureUser(p);
  console.log(`user ready: ${p.biz} (${p.phone})`);
  const esc = (s) => s.replaceAll("'", "''");
  sql += `
update profiles set role='professional', full_name='${esc(p.name)}', phone='${p.phone}',
  city_id=(select id from cities where name_he='${esc(p.city)}' limit 1) where id='${id}';
insert into professionals (id, business_name, bio, city_id, is_available, verification_status, working_hours, rating_avg, rating_count, jobs_completed)
values ('${id}', '${esc(p.biz)}', '${esc(p.bio)}',
  (select id from cities where name_he='${esc(p.city)}' limit 1), true,
  '${p.verified ? "approved" : "none"}', '${JSON.stringify(p.hours)}'::jsonb, ${p.rating}, ${p.count}, ${p.jobs})
on conflict (id) do update set business_name=excluded.business_name, bio=excluded.bio,
  city_id=excluded.city_id, working_hours=excluded.working_hours, verification_status=excluded.verification_status,
  rating_avg=excluded.rating_avg, rating_count=excluded.rating_count, jobs_completed=excluded.jobs_completed;
insert into professional_categories (professional_id, category_id)
select '${id}', id from categories where slug in (${p.cats.map((c) => `'${c}'`).join(",")})
on conflict do nothing;
`;
}
sql += "set session_replication_role = default;\n";

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
if (!res.ok) { console.error("SQL failed:", res.status, (await res.text()).slice(0, 800)); process.exit(1); }

const { count } = await admin.from("professionals").select("id", { count: "exact", head: true });
console.log(`\n✅ done — professionals in DB: ${count}`);

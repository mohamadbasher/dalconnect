import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const token = process.env.SUPABASE_TOKEN;
const ref = process.env.SUPABASE_REF;
const url = `https://${ref}.supabase.co`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  console.error("Failed to fetch keys:", res.status, (await res.text()).slice(0, 300));
  process.exit(1);
}
const keys = await res.json();
const anon = keys.find((k) => k.name === "anon")?.api_key;
const service = keys.find((k) => k.name === "service_role")?.api_key;
if (!anon) {
  console.error("anon key not found in response");
  process.exit(1);
}

const mask = (k) => (k ? `${k.slice(0, 6)}…${k.slice(-4)} (len ${k.length})` : "MISSING");

// mobile/.env
writeFileSync(
  join(root, "mobile", ".env"),
  `EXPO_PUBLIC_SUPABASE_URL=${url}\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${anon}\n`,
  "utf-8"
);
// admin/.env.local
writeFileSync(
  join(root, "admin", ".env.local"),
  `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}\nSUPABASE_SERVICE_ROLE_KEY=${service ?? ""}\n`,
  "utf-8"
);

console.log("Wrote mobile/.env and admin/.env.local");
console.log("  URL:  ", url);
console.log("  anon: ", mask(anon));
console.log("  service:", mask(service));

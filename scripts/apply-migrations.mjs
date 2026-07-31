import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const token = process.env.SUPABASE_TOKEN;
const ref = process.env.SUPABASE_REF;
if (!token || !ref) {
  console.error("Missing SUPABASE_TOKEN / SUPABASE_REF");
  process.exit(1);
}
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");

async function runSql(sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`\n❌ ${label} FAILED (${res.status})`);
    console.error(text.slice(0, 2000));
    process.exit(1);
  }
  console.log(`✅ ${label} applied`);
}

const files = process.argv.slice(2);
for (const f of files) {
  const sql = readFileSync(join(migrationsDir, f), "utf-8");
  await runSql(sql, f);
}
console.log("\nAll migrations applied.");

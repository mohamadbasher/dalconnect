// Test lib/suggest.ts for real: compile the actual file with tsc (deps stubbed),
// then run customer phrasings through it. Covers the keyword engine (which ships
// today) and the AI-failure fallback (which must never leave the user stranded).
import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MOBILE = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), "..", "mobile");
const DIR = path.join(process.env.TMP ?? process.env.TMPDIR ?? ".", "dalconnect-suggest-test");
mkdirSync(DIR, { recursive: true });

// the real file, untouched
cpSync(path.join(MOBILE, "lib/suggest.ts"), path.join(DIR, "suggest.ts"));

// stubs for its two imports
writeFileSync(
  path.join(DIR, "supabase.ts"),
  `type Invoke = <T>(name: string, opts?: unknown) => Promise<{ data: T | null; error: unknown }>;
   const impl = async () => {
     const mode = (globalThis as any).__AI_MODE;
     if (mode === "ok") return { data: { slugs: ["ac", "electrician"] }, error: null };
     if (mode === "hallucinate") return { data: { slugs: ["wizard", "plumber"] }, error: null };
     if (mode === "hang") return new Promise(() => {});
     return { data: null, error: new Error("function not deployed") };
   };
   export const supabase = { functions: { invoke: impl as unknown as Invoke } };\n`
);
writeFileSync(
  path.join(DIR, "types.ts"),
  `export type Lang = "ar" | "he";
   export interface Category { id: number; slug: string; name_ar: string; name_he: string; }\n`
);

execFileSync(
  "npx",
  ["tsc", path.join(DIR, "suggest.ts"), "--target", "es2020", "--module", "es2020",
   "--moduleResolution", "node", "--skipLibCheck", "--outDir", DIR],
  { cwd: MOBILE, stdio: "inherit", shell: true }
);
// tsc emits .js; give them .mjs names so node treats them as ESM
for (const f of ["suggest", "supabase", "types"]) {
  const js = path.join(DIR, f + ".js");
  let code = readFileSync(js, "utf8").replace(/from ['"]\.\/(\w+)['"]/g, "from './$1.mjs'");
  writeFileSync(path.join(DIR, f + ".mjs"), code);
}

const mod = await import(pathToFileURL(path.join(DIR, "suggest.mjs")).href);
const { matchByKeywords, suggestCategories } = mod;

const CATS = [
  ["electrician", "كهربائي", "חשמלאי"], ["plumber", "سبّاك", "אינסטלטור"],
  ["ac", "مكيفات", "מיזוג אוויר"], ["painter", "دهان", "צבעי"],
  ["carpenter", "نجّار", "נגר"], ["mechanic", "ميكانيكي", "מוסכניק"],
  ["cleaning", "تنظيف", "ניקיון"], ["gardening", "تنسيق حدائق", "גינון"],
  ["moving", "نقل عفش", "הובלות"], ["locksmith", "فتح أقفال", "מנעולן"],
  ["car-wash", "غسيل سيارات", "שטיפת רכב"], ["appliance-repair", "تصليح كهربائيات", "תיקון מוצרי חשמל"],
  ["phone-repair", "تصليح هواتف", "תיקון טלפונים"], ["computer-repair", "تصليح حواسيب", "תיקון מחשבים"],
  ["roofing", "ترميم أسطح", "תיקון גגות"], ["construction", "أعمال بناء", "עבודות בנייה"],
  ["tiling", "تبليط وسيراميك", "ריצוף וקרמיקה"], ["gypsum", "جبس وديكور", "גבס ועיצוב"],
  ["aluminum", "ألمنيوم وشبابيك", "אלומיניום וחלונות"], ["glass", "زجاج ومرايا", "זגגות ומראות"],
  ["solar", "دود شمس وطاقة شمسية", "דוד שמש וסולארי"], ["furniture-assembly", "تركيب أثاث", "הרכבת רהיטים"],
  ["pest-control", "مكافحة حشرات", "הדברה"], ["welding", "حدادة ولحام", "מסגרות וריתוך"],
  ["security-cameras", "كاميرات مراقبة", "מצלמות אבטחה"], ["internet-networks", "شبكات وإنترنت", "רשתות ואינטרנט"],
  ["tow-truck", "سحب سيارات", "גרר רכב"], ["sewage", "تسليك مجاري", "פתיחת סתימות"],
  ["beauty", "تجميل وعناية", "טיפוח ויופי"], ["hairdresser", "حلاقة وتصفيف", "מספרה ועיצוב שיער"],
  ["photography", "تصوير", "צילום"], ["events", "تنظيم مناسبات", "הפקת אירועים"],
].map(([slug, name_ar, name_he], i) => ({ id: i + 1, slug, name_ar, name_he }));

const CASES = [
  ["יש נזילה מתחת לכיור במטבח", "plumber"],
  ["המזגן לא מקרר בכלל", "ac"],
  ["אין חשמל בחדר שינה", "electrician"],
  ["השקע בסלון לא עובד", "electrician"],
  ["צריך לצבוע את הסלון", "painter"],
  ["המקרר לא מקרר", "appliance-repair"],
  ["מכונת הכביסה לא מסתובבת", "appliance-repair"],
  ["נשבר לי המסך של האייפון", "phone-repair"],
  ["יש ג׳וקים במטבח", "pest-control"],
  ["ננעלתי בחוץ, הדלת נעולה", "locksmith"],
  ["צריך ניקיון אחרי שיפוץ", "cleaning"],
  ["הרכב לא מניע וצריך גרר", "tow-truck"],
  ["רוצה להרכיב ארון מאיקאה", "furniture-assembly"],
  ["דוד השמש לא מחמם", "solar"],
  ["צריך להתקין מצלמות אבטחה בבית", "security-cameras"],
  ["הווייפי לא מגיע לחדר", "internet-networks"],
  ["רוצה תספורת בבית", "hairdresser"],
  ["מחפש צלם לחתונה", "photography"],
  ["הדשא בגינה מוזנח", "gardening"],
  ["צריך לרצף את המרפסת", "tiling"],
  ["في تسريب مي تحت المغسلة", "plumber"],
  ["المكيف مش مبرد", "ac"],
  ["ما في كهربا بالغرفة", "electrician"],
  ["بدي تنظيف بعد الترميم", "cleaning"],
  ["الثلاجة مش شغالة", "appliance-repair"],
  ["في صراصير بالمطبخ", "pest-control"],
  ["الباب مقفول وما بقدر افتحه", "locksmith"],
  ["بدي دهان للبيت", "painter"],
  ["السيارة معطلة بدي ونش", "tow-truck"],
  ["في سده بالمجاري", "sewage"],
  ["بدي غسيل سياره", "car-wash"],
  ["بدي كهربائي", "electrician"],
  ["צריך אינסטלטור דחוף", "plumber"],
  ["الكَهْرَبَاء مقطوعة", "electrician"],   // diacritics must not break it
];

let pass = 0;
const misses = [];
for (const [text, expect] of CASES) {
  const r = matchByKeywords(text, CATS, "he");
  if (r[0]?.category.slug === expect) pass++;
  else misses.push(`  "${text}"\n     want ${expect}, got ${r[0]?.category.slug ?? "(nothing)"}  [${r.slice(0,3).map(x=>x.category.slug).join(", ")}]`);
}
console.log(`keyword top-1: ${pass}/${CASES.length}`);
if (misses.length) console.log("misses:\n" + misses.join("\n"));

let fails = misses.length;
const check = (name, ok, extra = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
};

console.log("\nbehaviour:");
check("vague input returns nothing rather than guessing",
  matchByKeywords("שלום", CATS, "he").length === 0);
check("empty input is safe", matchByKeywords("", CATS, "he").length === 0);
check("never returns more than 4", matchByKeywords("חשמל מים מזגן צבע ניקיון גינה", CATS, "he").length <= 4);
const dual = matchByKeywords("יש סתימה בצנרת של האמבטיה", CATS, "he").map(d => d.category.slug);
check("a dual job surfaces both trades", dual.includes("sewage") && dual.includes("plumber"), dual.join(", "));
const conf = matchByKeywords("יש נזילה מתחת לכיור", CATS, "he");
check("top result has confidence 1", conf[0].confidence === 1);
check("confidence is descending", conf.every((c, i) => i === 0 || c.confidence <= conf[i-1].confidence));

console.log("\nAI path (edge function stubbed):");
globalThis.__AI_MODE = "error";
let r = await suggestCategories("המזגן לא מקרר", CATS, "he");
check("AI disabled -> keywords, still answers", r.source === "keywords" && r.results[0].category.slug === "ac");

// Re-import with the flag on. Every one of these must still return an answer:
// the customer is standing in a flooded kitchen, not debugging our backend.
process.env.EXPO_PUBLIC_AI_SUGGEST = "1";
const ai = await import(pathToFileURL(path.join(DIR, "suggest.mjs")).href + "?ai=1");

globalThis.__AI_MODE = "ok";
r = await ai.suggestCategories("המזגן לא מקרר", CATS, "he");
check("AI enabled -> uses AI result", r.source === "ai" && r.results[0].category.slug === "ac", r.results.map(x=>x.category.slug).join(", "));

globalThis.__AI_MODE = "hallucinate";
r = await ai.suggestCategories("יש נזילה", CATS, "he");
check("invented slug is dropped, real one kept",
  r.results.every((x) => CATS.some((c) => c.slug === x.category.slug)) && r.results.some(x => x.category.slug === "plumber"),
  r.results.map(x=>x.category.slug).join(", "));

globalThis.__AI_MODE = "error";
r = await ai.suggestCategories("המזגן לא מקרר", CATS, "he");
check("function not deployed -> falls back to keywords", r.source === "keywords" && r.results[0].category.slug === "ac");

globalThis.__AI_MODE = "hang";
const t0 = Date.now();
r = await ai.suggestCategories("יש נזילה מתחת לכיור", CATS, "he");
const waited = Date.now() - t0;
check("a hung edge function times out and still answers",
  r.source === "keywords" && r.results[0].category.slug === "plumber" && waited < 12000,
  `waited ${(waited / 1000).toFixed(1)}s`);

process.exit(fails ? 1 : 0);

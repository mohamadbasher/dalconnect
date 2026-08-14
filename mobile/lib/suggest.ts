// "I don't know which service I need" — turn a description of a problem into
// the trade that fixes it.
//
// Two engines, in order:
//   1. The `suggest-category` edge function (Claude). Understands paraphrase,
//      slang and typos — "the thing above the sink drips" finds a plumber.
//      Costs money per call and needs ANTHROPIC_API_KEY set on the project, so
//      it is OFF unless EXPO_PUBLIC_AI_SUGGEST=1.
//   2. A local keyword matcher. Free, instant, offline, and good enough for the
//      way people actually type ("נזילה", "מזגן לא מקרר", "الكهربا مقطوعة").
//
// The fallback is not a stub — it is the shipping default, and the AI path is
// an upgrade that slots in without touching the screen.
import { supabase } from "./supabase";
import type { Category, Lang } from "./types";

export type Suggestion = {
  category: Category;
  /** 0..1 — how sure we are. Drives the "best match" highlight, nothing else. */
  confidence: number;
};

export type SuggestResult = {
  results: Suggestion[];
  source: "ai" | "keywords";
};

const AI_ENABLED = process.env.EXPO_PUBLIC_AI_SUGGEST === "1";
const AI_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------- normalise

// Arabic diacritics + Hebrew niqqud/cantillation. People rarely type them, but
// keyboards on some phones insert them and they would break every match.
const MARKS = /[֑-ׇً-ٰٟ]/g;

/**
 * Fold a string to its bare consonants so "الكَهْرَبَاء" and "الكهرباء" match the
 * same keyword. Also folds the alef/ya/ta-marbuta variants people mix freely.
 */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/["'׳״`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Both languages glue their definite article onto the *second* word of a
 * compound, which plain substring matching misses: people write "מכונת הכביסה"
 * and "دود الشمس", never the dictionary form. Generating the articled variant
 * is one line and fixes a whole class of misses.
 */
function variants(folded: string): string[] {
  const words = folded.split(" ");
  if (words.length < 2) return [folded];
  const article = /[؀-ۿ]/.test(folded) ? "ال" : "ה";
  const last = words.length - 1;
  if (words[last].startsWith(article)) return [folded];
  return [folded, words.map((w, i) => (i === last ? article + w : w)).join(" ")];
}

// ---------------------------------------------------------------- keywords

/**
 * What people write when they have this problem — not what the trade is called.
 * A customer types "the fridge isn't cooling", never "appliance repair".
 *
 * Scoring uses keyword LENGTH, so a longer phrase automatically outranks a
 * shorter one sitting inside it: "דוד שמש" beats plumber's "דוד", with no
 * hand-tuned weights. Deliberate overlaps stay in — a blocked drain really is
 * both a plumber and a sewage job, and showing both is right.
 *
 * Length is only a proxy for specificity, and a few words are decisive despite
 * being short ("צלם" names the whole trade). Prefix those with `!` to score
 * them ×3. Use it sparingly — it exists for words that can mean nothing else.
 */
const KEYWORDS: Record<string, string[]> = {
  electrician: [
    "חשמל", "חשמלאי", "שקע", "מפסק", "לוח חשמל", "קצר חשמלי", "קצר", "פחת",
    "נורה", "מנורה", "תאורה", "גוף תאורה", "חוט חשמל", "אין חשמל", "שנאי", "מתג",
    "كهرب", "كهربا", "كهرباء", "فيش", "بريزه", "مفتاح كهرب", "لمبه", "اضاءه",
    "تماس", "سلك كهربا", "ما في كهربا", "قاطع",
  ],
  plumber: [
    "נזילה", "נוזל", "צנרת", "ברז", "כיור", "אסלה", "מקלחת", "דוד", "דוד מים",
    "מים", "טפטוף", "צינור", "מיכל הדחה", "לחץ מים", "בוילר", "אינסטלטור",
    "تسريب", "تسرب", "حنفيه", "مغسله", "مرحاض", "دوش", "سخان", "مي", "ميه",
    "ماء", "ماسوره", "بيبه", "سباك", "نقطه مي",
  ],
  ac: [
    "מזגן", "מיזוג", "מיזוג אוויר", "קירור", "מעבה", "גז מזגן", "מזגן לא מקרר",
    "מאוורר תקרה", "צ׳ילר",
    "مكيف", "تكييف", "تبريد", "كمبروسر", "المكيف مش مبرد", "فريون", "سبليت",
  ],
  painter: [
    "צבע", "צביעה", "סיוד", "לצבוע", "צבעי", "קילופים", "טיח",
    "دهان", "بويا", "صبغ", "طلاء", "دهن الحيط", "تبييض",
  ],
  carpenter: [
    "נגר", "נגרות", "ארון", "ארונות", "מטבח", "דלת עץ", "עץ", "מדף", "מגירה",
    "نجار", "خزانه", "دولاب", "باب خشب", "خشب", "مطبخ", "رف", "جارور",
  ],
  mechanic: [
    "מוסך", "מוסכניק", "רכב", "מנוע", "בלמים", "טיפול לרכב", "אוטו", "מכונית",
    "גיר", "מצבר", "תקלה ברכב",
    "ميكانيكي", "كراج", "سياره", "محرك", "فرامل", "بريك", "موتور", "جير",
    "بطاريه سياره",
  ],
  cleaning: [
    "ניקיון", "נקיון", "לנקות", "ניקוי", "מנקה", "ניקיון אחרי שיפוץ",
    "ניקיון בית", "עוזרת בית", "פוליש רצפה",
    // NOT "شغاله" on its own — folded it also matches "شغالة" ("working"), so
    // "الثلاجة مش شغالة" (a broken fridge) was landing here.
    "تنظيف", "نظافه", "تنضيف", "عامله تنظيف", "تنظيف بيت", "تنظيف بعد ترميم",
  ],
  gardening: [
    "גינה", "גינון", "דשא", "עצים", "גיזום", "השקיה", "גנן", "עשבים",
    "حديقه", "جنينه", "عشب", "شجر", "تقليم", "ري", "زراعه", "تنسيق حدائق",
  ],
  moving: [
    "הובלה", "הובלות", "מעבר דירה", "משאית", "ארגזים", "להעביר רהיטים", "מנוף",
    "نقل عفش", "نقله", "شاحنه", "ترحيل", "نقل اثاث", "رافعه",
  ],
  locksmith: [
    "מנעול", "מנעולן", "נעול", "ננעל", "פריצת דלת", "החלפת צילינדר", "צילינדר",
    "מפתח נשבר", "נעילה",
    "قفل", "مقفول", "فتح باب", "مفتاح انكسر", "سلندر", "فتح اقفال",
  ],
  "car-wash": [
    "שטיפת רכב", "שטיפה", "פוליש", "ניקוי פנים רכב", "וקס",
    "غسيل سياره", "غسيل", "بوليش", "تلميع", "تنظيف سياره",
  ],
  "appliance-repair": [
    "מקרר", "מכונת כביסה", "תנור", "מדיח", "מייבש", "מיקרוגל", "טכנאי מוצרי חשמל",
    "ثلاجه", "براد", "غساله", "فرن", "جلايه", "نشافه", "مايكرويف", "تصليح كهربائيات",
  ],
  "phone-repair": [
    "טלפון", "סלולרי", "מסך שבור", "אייפון", "נייד", "סוללה לטלפון", "תיקון טלפון",
    "تلفون", "موبايل", "شاشه مكسوره", "ايفون", "جوال", "تصليح تلفون", "بطاريه موبايل",
  ],
  "computer-repair": [
    "מחשב", "לפטופ", "מחשב נייד", "ווינדוס", "מדפסת", "וירוס", "טכנאי מחשבים",
    "كمبيوتر", "حاسوب", "لابتوب", "طابعه", "فيروس", "تصليح كمبيوتر",
  ],
  roofing: [
    "גג", "רעפים", "איטום", "נזילה בגג", "רטיבות בתקרה", "איטום גגות",
    "سطح", "سقف", "قرميد", "عزل", "تسريب من السطح", "رطوبه بالسقف",
  ],
  construction: [
    "בנייה", "בניה", "שיפוץ", "בטון", "קבלן", "תוספת בנייה", "הריסה", "יסודות",
    "بناء", "ترميم", "باطون", "مقاول", "هدم", "توسعه", "عمار",
  ],
  tiling: [
    "!ריצוף", "!לרצף", "אריחים", "קרמיקה", "פורצלן", "שיש", "רצפה", "חיפוי",
    "!بلاط", "سيراميك", "تبليط", "رخام", "ارضيه", "بورسلان",
  ],
  gypsum: [
    "גבס", "תקרה אקוסטית", "תקרת גבס", "ניסור", "עיצוב תקרה",
    "جبس", "ديكور", "سقف مستعار", "جبسون",
  ],
  aluminum: [
    // "מרפסת" alone was a false-positive magnet — a balcony gets tiled, painted
    // and cleaned far more often than it gets enclosed.
    "אלומיניום", "חלון", "חלונות", "תריס", "סגירת מרפסת", "סורג", "ויטרינה", "דלת הזזה",
    "ألمنيوم", "شباك", "شبابيك", "شيش", "درابزين", "تسكير بلكونه", "باب سحاب",
  ],
  glass: [
    "זכוכית", "מראה", "שמשה", "זגג", "מקלחון", "חלון שבור",
    "زجاج", "مرايا", "مرايه", "قزاز", "كابينه دوش", "شباك مكسور",
  ],
  solar: [
    "דוד שמש", "סולארי", "קולטים", "פאנלים סולאריים", "מערכת סולארית",
    "دود شمس", "طاقه شمسيه", "سخان شمسي", "الواح شمسيه", "سولار",
  ],
  "furniture-assembly": [
    "הרכבת רהיטים", "הרכבה", "איקאה", "להרכיב ארון", "להרכיב מיטה", "רהיטים",
    "تركيب اثاث", "تركيب", "ايكيا", "تجميع اثاث", "تركيب خزانه",
  ],
  "pest-control": [
    "מזיקים", "הדברה", "ג׳וקים", "גוקים", "נמלים", "עכברים", "יתושים", "תיקנים",
    "חולדות", "פשפשים",
    "حشرات", "مكافحه حشرات", "صراصير", "نمل", "فيران", "بق", "رش مبيد", "ناموس",
  ],
  welding: [
    "ריתוך", "מסגרות", "שער", "גדר", "ברזל", "מסגר", "מעקה",
    "حداده", "لحام", "بوابه", "سياج", "حديد", "درابزين حديد",
  ],
  "security-cameras": [
    "מצלמה", "מצלמות", "מצלמות אבטחה", "אבטחה", "אזעקה", "אינטרקום", "די וי אר",
    "كاميرا", "كاميرات", "مراقبه", "انذار", "انتركم", "كاميرات مراقبه",
  ],
  "internet-networks": [
    // people spell wifi every way there is
    "אינטרנט", "רשת", "!ראוטר", "!ווייפי", "!וויפי", "!wifi", "ואי פיי",
    "נקודת רשת", "כבל רשת", "מגבר",
    "انترنت", "شبكه", "!راوتر", "!واي فاي", "!wifi", "نقطه شبكه", "كيبل شبكه",
  ],
  "tow-truck": [
    "גרר", "גורר", "רכב תקוע", "תאונה", "לא מניע", "פנצ׳ר", "סוללה נגמרה",
    "سحب سياره", "ونش", "السياره معطله", "حادث", "ما بتشغل", "بنشر",
  ],
  sewage: [
    "סתימה", "ביוב", "פקק בצנרת", "ניאגרה", "שורשים בצנרת", "פתיחת סתימות",
    "ריח ביוב",
    "سده", "مجاري", "انسداد", "تسليك", "بياره", "ريحه مجاري",
  ],
  beauty: [
    "איפור", "ציפורניים", "לק ג׳ל", "קוסמטיקה", "גבות", "מניקור", "פדיקור",
    "مكياج", "اظافر", "تجميل", "حواجب", "منيكير", "بديكير", "عنايه",
  ],
  hairdresser: [
    "תספורת", "שיער", "מספרה", "צבע שיער", "החלקה", "מעצב שיער", "תסרוקת",
    "حلاقه", "شعر", "قص شعر", "كوافير", "صبغه شعر", "تسريحه",
  ],
  photography: [
    // "צלם"/"مصور" name the whole trade in three letters — short, but decisive
    // enough to outrank "חתונה" in "מחפש צלם לחתונה".
    "צילום", "!צלם", "!צלמת", "סטודיו", "צילומי אירוע", "וידאו", "מגנטים",
    "تصوير", "!مصور", "!مصوره", "استوديو", "فيديو", "تصوير مناسبات",
  ],
  events: [
    "אירוע", "חתונה", "מסיבה", "אולם", "קייטרינג", "הפקת אירועים", "ימי הולדת",
    "دي جيه",
    "حفله", "عرس", "مناسبه", "تنظيم مناسبات", "خطوبه", "عيد ميلاد", "ضيافه",
  ],
};

/**
 * Rank categories against a free-text problem description.
 *
 * Exported for its own sake: this is the offline engine, and it is also the
 * thing worth unit-testing — the AI path can't be asserted on.
 */
export function matchByKeywords(text: string, cats: Category[], lang: Lang): Suggestion[] {
  const hay = fold(text);
  if (hay.length < 2) return [];

  const scored = cats.map((cat) => {
    let score = 0;
    for (const raw of KEYWORDS[cat.slug] ?? []) {
      const strong = raw.startsWith("!");
      const needle = fold(strong ? raw.slice(1) : raw);
      if (!needle) continue;
      // Score the base length, not the matched variant's — an article shouldn't
      // make a keyword worth more.
      if (variants(needle).some((v) => hay.includes(v))) {
        score += needle.length * (strong ? 3 : 1);
      }
    }
    // Naming the trade outright is the strongest signal there is — and it costs
    // nothing to support the language the customer isn't currently reading in.
    for (const name of [cat.name_ar, cat.name_he]) {
      const needle = fold(name);
      if (needle.length >= 3 && hay.includes(needle)) score += needle.length * 2;
    }
    return { cat, score };
  });

  const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  if (hits.length === 0) return [];

  // Confidence is relative to the winner: a runaway top match reads as certain,
  // a near-tie reads as "these two, you pick".
  const top = hits[0].score;
  return hits.slice(0, 4).map((h) => ({
    category: h.cat,
    confidence: Math.min(1, h.score / top),
  }));
}

// ---------------------------------------------------------------- ai path

type AiResponse = { slugs?: string[] };

async function matchByAi(text: string, cats: Category[], lang: Lang): Promise<Suggestion[]> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("suggest-timeout")), AI_TIMEOUT_MS)
  );
  const call = supabase.functions.invoke<AiResponse>("suggest-category", {
    body: {
      text,
      lang,
      categories: cats.map((c) => ({ slug: c.slug, name_ar: c.name_ar, name_he: c.name_he })),
    },
  });

  const { data, error } = await Promise.race([call, timeout]);
  if (error) throw error;

  const bySlug = new Map(cats.map((c) => [c.slug, c]));
  const slugs = (data?.slugs ?? []).slice(0, 4);
  return slugs
    .map((slug, i) => {
      const category = bySlug.get(slug);
      // The model is asked for an ordered list, so position is the only
      // confidence signal we get — and the only one we need.
      return category ? { category, confidence: 1 - i * 0.2 } : null;
    })
    .filter((s): s is Suggestion => s !== null);
}

// ---------------------------------------------------------------- public

/**
 * Best-effort match. Never throws and never returns nothing without meaning it:
 * an empty `results` genuinely means "we couldn't tell", which the screen turns
 * into "browse all services" rather than a dead end.
 */
export async function suggestCategories(
  text: string,
  cats: Category[],
  lang: Lang
): Promise<SuggestResult> {
  if (AI_ENABLED) {
    try {
      const results = await matchByAi(text, cats, lang);
      if (results.length > 0) return { results, source: "ai" };
    } catch {
      // Offline, function not deployed, no API key, model hiccup — all the same
      // to the customer, who just wants an answer. Fall through.
    }
  }
  return { results: matchByKeywords(text, cats, lang), source: "keywords" };
}

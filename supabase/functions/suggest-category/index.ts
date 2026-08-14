// suggest-category — "I don't know which service I need".
//
// Takes a free-text problem description and returns the trades that fix it,
// best first. The mobile app calls this only when EXPO_PUBLIC_AI_SUGGEST=1;
// otherwise it uses its local keyword matcher and never reaches here.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy suggest-category
//   # then set EXPO_PUBLIC_AI_SUGGEST=1 in mobile/.env
//
// Auth: verify_jwt stays ON (the default) so only signed-in customers can spend
// tokens here. The app's supabase client sends the session automatically.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = "claude-sonnet-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Cat = { slug: string; name_ar: string; name_he: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { text, lang, categories } = (await req.json()) as {
      text?: string;
      lang?: "ar" | "he";
      categories?: Cat[];
    };

    if (!text?.trim() || !Array.isArray(categories) || categories.length === 0) {
      return json({ error: "text and categories are required" }, 400);
    }

    // No key configured — say so plainly rather than 500ing. The client treats
    // any failure as "use keywords", so this degrades to a working app.
    if (!ANTHROPIC_API_KEY) return json({ slugs: [], reason: "no-api-key" });

    // The catalogue is passed in by the client so this function never has to be
    // redeployed when the admin adds a trade.
    const menu = categories
      .map((c) => `${c.slug}: ${c.name_ar} / ${c.name_he}`)
      .join("\n");

    const prompt = [
      "A customer described a problem they need fixed at home or with their car.",
      "Pick the trades that would fix it, best match first.",
      "",
      "Available trades (slug: Arabic / Hebrew name):",
      menu,
      "",
      `Customer wrote (${lang === "ar" ? "Arabic" : "Hebrew"}):`,
      `"""${text.slice(0, 800)}"""`,
      "",
      "Rules:",
      "- Reply with ONLY a JSON array of slugs, e.g. [\"plumber\",\"sewage\"].",
      "- At most 4, ordered best first. Only slugs from the list above.",
      "- If two trades genuinely both apply (a blocked drain is plumbing and sewage), include both.",
      "- If the description is too vague to tell, reply []. Do not guess.",
    ].join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("anthropic error", res.status, (await res.text()).slice(0, 300));
      return json({ slugs: [], reason: "upstream" });
    }

    const body = await res.json();
    const raw = body?.content?.[0]?.text ?? "";

    // Take the first JSON array in the reply — models sometimes wrap it in prose
    // or a code fence despite being told not to.
    const match = raw.match(/\[[\s\S]*?\]/);
    let slugs: string[] = [];
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) slugs = parsed.filter((s): s is string => typeof s === "string");
      } catch {
        // fall through to []
      }
    }

    // Never let a hallucinated slug reach the client.
    const valid = new Set(categories.map((c) => c.slug));
    return json({ slugs: slugs.filter((s) => valid.has(s)).slice(0, 4) });
  } catch (err) {
    console.error("suggest-category failed", err);
    return json({ slugs: [], reason: "error" });
  }
});

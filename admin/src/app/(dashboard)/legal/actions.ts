"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEGAL_KEYS, LEGAL_KEY_LABELS } from "./keys";
import type { LegalPageKey } from "@/lib/types";

export async function saveLegalPage(formData: FormData): Promise<void> {
  await requireAdmin();
  const key = String(formData.get("key") ?? "") as LegalPageKey;
  if (!LEGAL_KEYS.includes(key)) return;

  const title_ar = String(formData.get("title_ar") ?? "").trim();
  const title_he = String(formData.get("title_he") ?? "").trim();
  // Bodies keep their newlines — the app renders them verbatim.
  const body_ar = String(formData.get("body_ar") ?? "").trimEnd();
  const body_he = String(formData.get("body_he") ?? "").trimEnd();

  const db = createAdminClient();
  await db
    .from("legal_pages")
    .upsert(
      { key, title_ar, title_he, body_ar, body_he, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  // Logged on the user-scoped client (see lib/audit.ts) so auth.uid() resolves.
  await logAction(
    "legal.upsert",
    "legal_page",
    key,
    `تحديث صفحة «${LEGAL_KEY_LABELS[key]}»`,
    {
      key,
      ar_override: body_ar.trim().length > 0,
      he_override: body_he.trim().length > 0,
      ar_chars: body_ar.length,
      he_chars: body_he.length,
    },
  );

  revalidatePath("/legal");
  redirect(`/legal?key=${key}&saved=1`);
}

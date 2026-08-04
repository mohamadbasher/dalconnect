import { S } from "@/lib/strings";
import type { LegalPageKey } from "@/lib/types";

/** Mirrors the CHECK constraint on `legal_pages.key`. */
export const LEGAL_KEYS: LegalPageKey[] = ["terms", "privacy", "about", "contact"];

export const LEGAL_KEY_LABELS: Record<LegalPageKey, string> = {
  terms: S.legalKeyTerms,
  privacy: S.legalKeyPrivacy,
  about: S.legalKeyAbout,
  contact: S.legalKeyContact,
};

export const LEGAL_KEY_ICONS: Record<LegalPageKey, string> = {
  terms: "📜",
  privacy: "🔒",
  about: "ℹ️",
  contact: "✉️",
};

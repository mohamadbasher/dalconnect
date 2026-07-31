// DalConnect i18n — Arabic + Hebrew (both RTL).
// Dictionaries are split by feature under ./dict — each key maps to {ar, he}.
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setFontLang } from "../font";
import type { Lang } from "../types";

import { common } from "./dict/common";
import { auth } from "./dict/auth";
import { home } from "./dict/home";
import { booking } from "./dict/booking";
import { pro } from "./dict/pro";
import { chat } from "./dict/chat";
import { profile } from "./dict/profile";

export type Dict = Record<string, { ar: string; he: string }>;

const DICT: Dict = { ...common, ...auth, ...home, ...booking, ...pro, ...chat, ...profile };

const LANG_KEY = "dalconnect.lang";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** pick the right localized column from a DB row, e.g. loc(cat, 'name') */
  loc: (row: any, field: string) => string;
};

const Ctx = createContext<I18nCtx>({
  lang: "ar",
  setLang: () => {},
  t: (k) => k,
  loc: () => "",
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  // Gate rendering until the saved language loads, so a Hebrew user never
  // sees a flash of Arabic (or vice versa) before their choice applies.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      const resolved: Lang = v === "he" ? "he" : "ar";
      setLangState(resolved);
      setFontLang(resolved);
      setReady(true);
    });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    setFontLang(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
  };

  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang,
      t: (key, params) => {
        let s = DICT[key]?.[lang] ?? key;
        if (params) {
          for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
        }
        return s;
      },
      loc: (row, field) => {
        if (!row) return "";
        return row[`${field}_${lang}`] ?? row[`${field}_ar`] ?? "";
      },
    }),
    [lang]
  );

  if (!ready) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const LANG_NAMES: Record<Lang, string> = { ar: "العربية", he: "עברית" };

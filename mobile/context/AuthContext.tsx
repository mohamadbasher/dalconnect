import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase, phoneToEmail, providerNoToEmail, identifierToEmail } from "../lib/supabase";
import { registerPushToken } from "../lib/notifications";
import type { Lang, Professional, Profile } from "../lib/types";

/** Professionals can flip between using the app as a customer or as a pro. */
export type AccountMode = "customer" | "pro";
const MODE_KEY = "dalconnect.mode";

type AuthCtx = {
  session: Session | null;
  profile: Profile | null;
  professional: Professional | null;
  mode: AccountMode;
  loading: boolean;
  isPro: boolean;
  isAdmin: boolean;
  setMode: (m: AccountMode) => void;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (args: { fullName: string; phone: string; password: string; lang: Lang }) => Promise<void>;
  /** Register a provider account; resolves to their six-digit login number. */
  signUpProvider: (args: { fullName: string; phone: string; password: string; businessName: string; lang: Lang }) => Promise<string>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  profile: null,
  professional: null,
  mode: "customer",
  loading: true,
  isPro: false,
  isAdmin: false,
  setMode: () => {},
  signIn: async () => {},
  signUp: async () => {},
  signUpProvider: async () => "",
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [mode, setModeState] = useState<AccountMode>("customer");
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async (s: Session | null) => {
    if (!s?.user) {
      setProfile(null);
      setProfessional(null);
      return;
    }
    // Not `from("profiles").select("*")`: migration 20260714000011 revoked the
    // table-level SELECT grant so nobody can harvest other people's phone
    // numbers, and a `select=*` against a column-granted table fails outright
    // rather than returning a partial row. This RPC returns the caller's own
    // row — the one place a full profile, phone included, is legitimate.
    const { data: rpcProfile } = await supabase.rpc("get_my_profile").single();
    const prof = (rpcProfile as Profile | null) ?? null;
    setProfile(prof);
    if (prof?.role === "professional" || prof?.role === "admin") {
      const { data: pro } = await supabase.from("professionals").select("*").eq("id", s.user.id).maybeSingle();
      setProfessional((pro as Professional) ?? null);
    } else {
      setProfessional(null);
    }
    registerPushToken(s.user.id); // fire and forget
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((v) => {
      if (v === "customer" || v === "pro") setModeState(v);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadAccount(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await loadAccount(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadAccount]);

  const setMode = (m: AccountMode) => {
    setModeState(m);
    AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
  };

  /** Accepts a customer phone OR a provider's six-digit login number. */
  const signIn = async (identifier: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: identifierToEmail(identifier),
      password,
    });
    if (error) throw error;
  };

  const signUp = async ({ fullName, phone, password, lang }: { fullName: string; phone: string; password: string; lang: Lang }) => {
    const { error } = await supabase.auth.signUp({
      email: phoneToEmail(phone),
      password,
      options: { data: { full_name: fullName, phone: phone.replace(/\D/g, ""), lang } },
    });
    if (error) throw error;
  };

  /**
   * Register a service provider — a separate account from any customer account
   * on the same phone. Returns the six-digit number they will sign in with.
   *
   * The number is the last six digits of the phone; if that is taken the server
   * suggests a free one. Because it is the local part of the login email, a
   * lost race shows up as "already registered", and we simply ask for another.
   */
  const signUpProvider = async ({
    fullName,
    phone,
    password,
    businessName,
    lang,
  }: {
    fullName: string;
    phone: string;
    password: string;
    businessName: string;
    lang: Lang;
  }): Promise<string> => {
    const digits = phone.replace(/\D/g, "");

    const { data: exists } = await supabase.rpc("provider_exists_for_phone", { p_phone: digits });
    if (exists) throw new Error("PROVIDER_EXISTS");

    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: suggested, error: rpcErr } = await supabase.rpc("suggest_provider_no", {
        p_phone: digits,
      });
      if (rpcErr || !suggested) throw rpcErr ?? new Error("NO_PROVIDER_NUMBER");
      const providerNo = String(suggested);

      const { error } = await supabase.auth.signUp({
        email: providerNoToEmail(providerNo),
        password,
        options: {
          data: {
            full_name: fullName,
            phone: digits,
            lang,
            role: "professional",
            provider_no: providerNo,
            business_name: businessName,
          },
        },
      });
      if (!error) return providerNo;
      // someone took that number between the suggestion and the insert
      if (!/already (registered|exists)|user_already_exists/i.test(error.message)) throw error;
    }
    throw new Error("NO_PROVIDER_NUMBER");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setModeState("customer");
    AsyncStorage.removeItem(MODE_KEY).catch(() => {});
  };

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadAccount(data.session);
  }, [loadAccount]);

  const isPro = profile?.role === "professional" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";

  const value = useMemo(
    () => ({
      session,
      profile,
      professional,
      mode: isPro ? mode : "customer" as AccountMode,
      loading,
      isPro,
      isAdmin,
      setMode,
      signIn,
      signUp,
      signUpProvider,
      signOut,
      refresh,
    }),
    [session, profile, professional, mode, loading, isPro, isAdmin, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

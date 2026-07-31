import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase, phoneToEmail } from "../lib/supabase";
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
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", s.user.id).single();
    setProfile((prof as Profile) ?? null);
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

  const signIn = async (identifier: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(identifier),
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
      signOut,
      refresh,
    }),
    [session, profile, professional, mode, loading, isPro, isAdmin, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

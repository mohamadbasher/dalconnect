import React, { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { Loading } from "../components/ui";
import { hasOnboarded } from "../lib/onboarding";

export default function Index() {
  const { session, loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    hasOnboarded().then(setOnboarded);
  }, []);

  if (loading || onboarded === null) return <Loading />;
  if (session) return <Redirect href="/(tabs)" />;
  // Welcome shows only on first launch; afterwards go straight to sign-in.
  return <Redirect href={onboarded ? "/(auth)/sign-in" : "/(auth)/welcome"} />;
}

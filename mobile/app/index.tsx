// Where a launch (or a fresh sign-in) lands.
//
// This is the ONE place that decides, which is why the auth screens all
// redirect here rather than naming a tab themselves: they finish before the
// profile has loaded, so they cannot know whether this is a customer or a
// provider without duplicating the wait.
import React, { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { Loading } from "../components/ui";
import { hasOnboarded } from "../lib/onboarding";

export default function Index() {
  const { session, profile, loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    hasOnboarded().then(setOnboarded);
  }, []);

  if (loading || onboarded === null) return <Loading />;

  if (session) {
    // A session exists but the profile is still loading. Waiting one beat is
    // the whole fix: `/(tabs)` renders the customer home, so redirecting before
    // the role is known lands every provider on the customer service-picker.
    if (!profile) return <Loading />;
    return (
      <Redirect href={profile.role === "professional" ? "/(tabs)/dashboard" : "/(tabs)"} />
    );
  }

  // Welcome shows only on first launch; afterwards go straight to sign-in.
  return <Redirect href={onboarded ? "/(auth)/sign-in" : "/(auth)/welcome"} />;
}

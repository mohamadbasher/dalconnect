"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { identifierToEmail } from "@/lib/auth";

export async function signIn(formData: FormData): Promise<void> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    redirect("/login?error=missing");
  }

  const email = identifierToEmail(identifier);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect("/login?error=invalid");
  }

  // Verify the account is an admin — everyone else gets signed out.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/login?error=not_admin");
  }

  redirect("/");
}

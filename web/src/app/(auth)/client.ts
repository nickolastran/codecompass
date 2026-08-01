"use client";

import { createClient } from "@/utils/supabase/client";

export async function signInWithProvider(provider: "github" | "gitlab") {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    },
  });

  if (error) {
    console.error(`Error signing in with ${provider}:`, error.message);
  } else if (data?.url) {
    window.location.href = data.url; // Redirect to the provider’s OAuth page
  }
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Error signing out:", error.message);
    return;
  }

  window.location.href = "/";
}

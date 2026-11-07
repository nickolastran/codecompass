import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ActionResult } from "@/app/types/action";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}

// Server client plus the signed-in user (null when signed out)
export async function authed() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return { client, user };
}

export const NOT_AUTHED = {
  success: false,
  error: "User not authenticated!",
} as const;

// A Supabase { data, error } response as an ActionResult
export function toResult<T>({
  data,
  error,
}: {
  data: unknown;
  error: { message: string } | null;
}): ActionResult<T> {
  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
  return { success: true, data: data as T };
}

// Admin client using secret key - bypasses RLS policies
// ONLY use for trusted server-side operations that need elevated permissions
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

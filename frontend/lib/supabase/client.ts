"use client";

import { createBrowserClient } from "@supabase/ssr";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase(): any {
  if (!isSupabaseConfigured) {
    return {
      auth: {
        getUser: async () => ({ data: { user: null } }),
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp: async () => ({ error: null, data: {} }),
        signInWithPassword: async () => ({ error: null, data: {} }),
        signInWithOAuth: async () => ({ error: null, data: {} }),
        signOut: async () => ({ error: null }),
      },
    };
  }
  try {
    _client ??= createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    return _client;
  } catch {
    return {
      auth: {
        getUser: async () => ({ data: { user: null } }),
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp: async () => ({ error: null, data: {} }),
        signInWithPassword: async () => ({ error: null, data: {} }),
        signInWithOAuth: async () => ({ error: null, data: {} }),
        signOut: async () => ({ error: null }),
      },
    };
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}
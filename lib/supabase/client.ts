"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

let client: SupabaseClient | null | undefined;
let anonymousUserPromise: Promise<User> | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!isSupabaseConfigured) {
    client = null;
    return client;
  }

  client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

export function ensureAnonymousUser(): Promise<User> {
  if (!anonymousUserPromise) {
    anonymousUserPromise = (async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) return session.user;

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      if (!data.user) throw new Error("SUPABASE_AUTH_FAILED");
      return data.user;
    })().catch((error) => {
      anonymousUserPromise = null;
      throw error;
    });
  }
  return anonymousUserPromise;
}

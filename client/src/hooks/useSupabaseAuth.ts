// client/src/hooks/useSupabaseAuth.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type AnyUser = any;

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AnyUser | null;
  profile: any | null;
};

export function useSupabaseAuth(): AuthState {
  const [isLoading, setLoading] = useState(true);
  const [user, setUser] = useState<AnyUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadExistingSession() {
      // ✅ This immediately resolves when you open a new tab with an existing session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!alive) return;

      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);

      if (u) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", u.id)
          .single();
        if (alive) setProfile(data ?? null);
      } else {
        setProfile(null);
      }
    }

    loadExistingSession();

    // ✅ Keep auth state in sync for SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED, etc.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;

      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);

      if (u) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", u.id)
          .single()
          .then(({ data }) => {
            if (alive) setProfile(data ?? null);
          });
      } else {
        setProfile(null);
      }
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return { isLoading, isAuthenticated: !!user, user, profile };
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// `teacher` is true when the account said "I teach" at sign-up. That choice lives on the account, so it holds on any device.
export type OwnerSession =
  { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; email: string; teacher: boolean; termsVersion: string | null };

/** The signed-in user from the browser session. This only decides what to show; the server functions enforce access. */
export function useOwnerSession(): OwnerSession {
  const [session, setSession] = useState<OwnerSession>({ status: "loading" });

  useEffect(() => {
    let active = true;
    type AuthUser = { email?: string | undefined; user_metadata?: Record<string, unknown> } | null | undefined;
    const toSession = (user: AuthUser): OwnerSession =>
      !user
        ? { status: "signed-out" }
        : { status: "signed-in", email: user.email ?? "", teacher: user.user_metadata?.["role"] === "teacher", termsVersion: typeof user.user_metadata?.["terms_version"] === "string" ? user.user_metadata["terms_version"] : null };

    supabase.auth.getUser().then(({ data }) => {
      if (active) setSession(toSession(data.user));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(toSession(next?.user));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return session;
}

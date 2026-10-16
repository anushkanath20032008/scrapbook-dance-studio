import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OwnerSession =
  { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; email: string };

/** The signed-in user from the browser session. This only decides what to show; the server functions enforce access. */
export function useOwnerSession(): OwnerSession {
  const [session, setSession] = useState<OwnerSession>({ status: "loading" });

  useEffect(() => {
    let active = true;
    const toSession = (email: string | undefined | null): OwnerSession =>
      email === undefined ? { status: "signed-out" } : { status: "signed-in", email: email ?? "" };

    supabase.auth.getUser().then(({ data }) => {
      if (active) setSession(toSession(data.user ? data.user.email : undefined));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(toSession(next?.user ? next.user.email : undefined));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return session;
}

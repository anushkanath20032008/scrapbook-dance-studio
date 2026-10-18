import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MemberSignIn } from "@/components/member/member-sign-in";
import { useOwnerSession } from "@/hooks/use-owner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "My classes and fees | Choreo Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MemberLayout,
});

/** The dancer area. It never creates a studio profile: it only reads what the signed-in account belongs to. */
function MemberLayout() {
  const session = useOwnerSession();

  if (session.status === "loading") {
    return (
      <main className="section login-page">
        <div className="wrap login-wrap">
          <p>Loading…</p>
        </div>
      </main>
    );
  }
  if (session.status === "signed-out") {
    return (
      <main className="section login-page">
        <div className="wrap login-wrap">
          <a href="/">← Choreo Studio</a>
          <h1 className="display login-title">Your classes.</h1>
          <MemberSignIn next="/me" title="Sign in as a dancer" />
          <p className="console-hint">
            New here? Ask your studio for an invite, then <Link to="/join">enter your code</Link>.
          </p>
        </div>
      </main>
    );
  }
  return (
    <main className="section login-page">
      <div className="wrap login-wrap">
        <p className="console-hint">
          {session.email} ·{" "}
          <Button variant="retroPaper" type="button" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </p>
        <Outlet />
      </div>
    </main>
  );
}

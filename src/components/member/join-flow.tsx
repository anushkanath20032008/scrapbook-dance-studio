import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { MemberSignIn } from "@/components/member/member-sign-in";
import { useOwnerSession } from "@/hooks/use-owner";
import { redeemMemberInvite } from "@/lib/members.functions";
import { clearPendingInvite, readPendingInvite, savePendingInvite } from "@/lib/pending-invite";

const INVALID = "This invite is not valid. Ask your studio for a new one.";

/**
 * Join a studio with an invite. The secret comes from the `/join/<secret>` link or is typed as a code. It is
 * kept aside (and taken out of the address bar), the dancer signs in or signs up, and it is redeemed once.
 * Every invalid invite shows the same message.
 */
export function JoinFlow({ linkSecret }: { linkSecret?: string | undefined }) {
  const navigate = useNavigate();
  const session = useOwnerSession();
  const queryClient = useQueryClient();
  const redeem = useServerFn(redeemMemberInvite);
  const [pending, setPending] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const started = useRef(false);

  // Take the secret out of the URL as soon as the page loads, and pick up one saved before a sign-in redirect.
  useEffect(() => {
    if (linkSecret) {
      savePendingInvite(linkSecret);
      window.history.replaceState(null, "", "/join");
    }
    setPending(readPendingInvite());
    setReady(true);
  }, [linkSecret]);

  const mutation = useMutation({
    mutationFn: (secret: string) => redeem({ data: { secret } }),
    onSuccess: async () => {
      clearPendingInvite();
      await queryClient.invalidateQueries({ queryKey: ["my-studios"] });
      void navigate({ to: "/me" });
    },
    onError: () => {
      clearPendingInvite();
      setPending(null);
      setError(INVALID);
    },
  });

  useEffect(() => {
    if (pending && session.status === "signed-in" && !started.current) {
      started.current = true;
      mutation.mutate(pending);
    }
  }, [pending, session.status, mutation]);

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (code.trim().length < 8) {
      setError("Enter the code or link your studio gave you.");
      return;
    }
    setError("");
    savePendingInvite(code.trim());
    started.current = false;
    setPending(code.trim());
  }

  function startOver() {
    clearPendingInvite();
    started.current = false;
    setPending(null);
    setCode("");
    setError("");
  }

  let body;
  if (!ready || session.status === "loading" || mutation.isPending) {
    body = <p>{mutation.isPending ? "Joining your studio…" : "Loading…"}</p>;
  } else if (pending && session.status === "signed-out") {
    body = (
      <>
        <MemberSignIn next="/join" title="Sign in to join your studio" />
        <p className="login-links">
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault();
              startOver();
            }}
          >
            Use a different code
          </a>
        </p>
      </>
    );
  } else {
    body = (
      <div className="window">
        <div className="window-bar chrome-font">Join.dialog</div>
        <div className="window-inner">
          <p>Enter the code your studio gave you. You can also open the link they sent.</p>
          <form onSubmit={submitCode}>
            <label className="form-label">
              Invite code
              <input
                className="field"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setError("");
                }}
                aria-invalid={error !== ""}
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="ABCD-EFGH"
              />
            </label>
            {error !== "" && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}
            <div className="login-actions">
              <Button variant="retro" type="submit">
                Continue
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <main className="section login-page">
      <div className="wrap login-wrap">
        <a href="/">← Choreo Studio</a>
        <h1 className="display login-title">Join your studio.</h1>
        {body}
      </div>
    </main>
  );
}

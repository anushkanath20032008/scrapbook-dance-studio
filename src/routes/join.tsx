import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { useOwnerSession } from "@/hooks/use-owner";
import { acceptInstructorInvite } from "@/lib/instructors.functions";

// Where an instructor lands from the owner's invite link. They sign in (or create an account) and accept.
export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>): { code?: string } =>
    typeof search["code"] === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(search["code"])
      ? { code: search["code"] }
      : {},
  head: () => ({
    meta: [
      { title: "Join your studio | ChoreoStudio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Join,
});

function Join() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useOwnerSession();
  const { code: linkCode } = Route.useSearch();
  const accept = useServerFn(acceptInstructorInvite);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState<string | null>(null);

  const secret = linkCode ?? typed.trim();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await accept({ data: { secret } });
      if (result.studioName === null) {
        setError(
          "That invite did not work. It may be used, expired, or sent to a different email. Ask your studio for a new one.",
        );
      } else {
        await queryClient.invalidateQueries({ queryKey: ["console-context"] });
        setJoined(result.studioName);
      }
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="section login-page">
      <div className="wrap login-wrap">
        <a href="/">← ChoreoStudio</a>
      <div className="window">
        <div className="window-bar chrome-font">Join your studio</div>
        <div className="window-inner console-form">
          {joined !== null ? (
            <>
              <h1 className="display">You are in.</h1>
              <p>You can now mark attendance for {joined}.</p>
              <Button variant="retro" type="button" onClick={() => void navigate({ to: "/app" })}>
                Open attendance
              </Button>
            </>
          ) : session.status === "loading" ? (
            <p>Loading…</p>
          ) : session.status === "signed-out" ? (
            <>
              <h1 className="display">Join as an instructor.</h1>
              <p>Sign in or create an account first. Use the email your studio invited, if they gave one.</p>
              <div className="attend-bar">
                <Link
                  className="setup-go"
                  to="/login"
                  search={linkCode ? { join: linkCode } : {}}
                >
                  Sign in
                </Link>
                <Link
                  className="setup-go"
                  to="/login"
                  search={linkCode ? { mode: "register", join: linkCode } : { mode: "register" }}
                >
                  Create an account
                </Link>
              </div>
            </>
          ) : (
            <form className="console-form" onSubmit={submit} noValidate>
              <h1 className="display">Join as an instructor.</h1>
              <p>Signed in as {session.email}.</p>
              {!linkCode && (
                <label className="form-label console-field">
                  Invite code
                  <input
                    className="field"
                    autoComplete="off"
                    autoCapitalize="characters"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                  />
                </label>
              )}
              <Button variant="retro" type="submit" disabled={busy || secret.length < 8}>
                {busy ? "Joining…" : "Accept invite"}
              </Button>
              <FormAlert message={error} />
              <p className="console-hint">
                An instructor sees batches, dancer names and attendance. Nothing about fees or phone
                numbers.
              </p>
            </form>
          )}
        </div>
      </div>
      </div>
    </main>
  );
}

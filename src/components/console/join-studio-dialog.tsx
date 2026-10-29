import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { acceptInstructorInvite } from "@/lib/instructors.functions";
import { setRoleIntent } from "@/lib/role-intent";

/** The first thing a dance teacher sees: which studio do you teach at? It cannot be closed without choosing. */
export function JoinStudioDialog({ onLeave }: { onLeave: () => void }) {
  const queryClient = useQueryClient();
  const accept = useServerFn(acceptInstructorInvite);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await accept({ data: { secret: code.trim() } });
      if (result.studioName === null) {
        setError("That code did not work. It may be used, expired, or sent to a different email. Ask your studio for a new one.");
      } else {
        await queryClient.invalidateQueries();
      }
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleDialog open onOpenChange={() => undefined} title="Which studio do you teach at?">
      <form className="console-form" onSubmit={submit} noValidate>
        <p>Ask your studio owner for an invite code. Enter it here to join their studio.</p>
        <label className="form-label console-field">
          Invite code
          <input
            className="field"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <FormAlert message={error} />
        <div className="console-actions">
          <Button variant="retro" type="submit" disabled={busy || code.trim().length < 8}>
            {busy ? "Joining…" : "Join this studio"}
          </Button>
          <Button
            variant="retroPaper"
            type="button"
            title="Choose this if you own a dance studio"
            onClick={() => {
              setRoleIntent("owner");
              onLeave();
            }}
          >
            I own a dance studio instead
          </Button>
        </div>
      </form>
    </ConsoleDialog>
  );
}

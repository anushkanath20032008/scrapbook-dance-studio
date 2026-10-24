import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { inviteInstructor, listInstructors, removeInstructor } from "@/lib/instructors.functions";

// Owner only. Instructors see batches, dancer names and attendance, and nothing else; the database enforces it.
export const Route = createFileRoute("/app/team")({
  head: () => ({ meta: [{ title: "Team | ChoreoStudio" }] }),
  component: Team,
});

type Invite = { url: string; code: string; email: string | null };

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function Team() {
  const queryClient = useQueryClient();
  const inviteFn = useServerFn(inviteInstructor);
  const listFn = useServerFn(listInstructors);
  const removeFn = useServerFn(removeInstructor);

  const [email, setEmail] = useState("");
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<Invite | null>(null);

  const team = useQuery({ queryKey: ["instructors"], queryFn: () => listFn() });

  const create = useMutation({
    mutationFn: () => inviteFn({ data: { email, days } }),
    onSuccess: (result) => {
      setError("");
      setInvite({ url: result.url, code: result.code, email: email.trim() || null });
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: ["instructors"] });
    },
    onError: (e) => setError(messageOf(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed. They can no longer open anything.");
      void queryClient.invalidateQueries({ queryKey: ["instructors"] });
    },
    onError: (e) => toast.error(messageOf(e)),
  });

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied.`);
    } catch {
      toast.error("Could not copy. Select the text and copy it.");
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setInvite(null);
    create.mutate();
  }

  const now = Date.now();
  return (
    <section>
      <h1 className="display console-title">Team</h1>
      <p className="console-hint">
        An instructor can see your batches and the names of the dancers on them, and mark attendance.
        They cannot see phone numbers, fees, payments or your account.
      </p>

      <div className="window">
        <div className="window-bar chrome-font">Invite an instructor</div>
        <form className="window-inner console-form" onSubmit={submit} noValidate>
          <Field label="Their email" hint="Leave empty to get a link you can send on WhatsApp.">
            <input
              className="field"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Invite works for">
            <select
              className="field"
              value={days}
              onChange={(event) => setDays(Number(event.target.value) as 1 | 7 | 30)}
            >
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </Field>
          <Button variant="retro" type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create invite"}
          </Button>
          <FormAlert message={error} />
        </form>
      </div>

      {invite && (
        <div className="window" role="status">
          <div className="window-bar chrome-font">Send this to {invite.email ?? "your instructor"}</div>
          <div className="window-inner console-form">
            <p>
              They open the link, sign in or create an account{invite.email ? ` with ${invite.email}` : ""}, and
              accept. It works once. We cannot show it again, so copy it now.
            </p>
            <input className="field" readOnly value={invite.url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
            <div className="attend-bar">
              <Button variant="retro" type="button" onClick={() => void copy(invite.url, "Link")}>
                Copy link
              </Button>
              <span className="console-hint">
                Or they can enter this code on the join page: <strong>{invite.code}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="console-list-head">
        <h2 className="display">Your team</h2>
      </div>
      {team.isError && <p role="alert">Could not load your team. Please refresh.</p>}
      {team.data?.length === 0 && <p className="console-empty">No instructors yet.</p>}
      <ul className="console-list">
        {team.data?.map((person) => {
          const accepted = person.accepted_at !== null;
          const expired = !accepted && new Date(person.expires_at).getTime() <= now;
          return (
            <li key={person.id} className="console-row">
              <div>
                <strong>{person.email ?? "Link invite"}</strong>
                <span className="console-hint">
                  {accepted
                    ? ` Joined ${dayLabel(person.accepted_at as string)}`
                    : expired
                      ? ` Invite expired ${dayLabel(person.expires_at)}`
                      : ` Invited, open until ${dayLabel(person.expires_at)}`}
                </span>
              </div>
              <div className="console-row-actions">
                <span className="status-pill" data-tone={accepted ? "good" : expired ? "idle" : "warn"}>
                  {accepted ? "Instructor" : expired ? "Expired" : "Waiting"}
                </span>
                <Button
                  variant="retroPaper"
                  type="button"
                  disabled={remove.isPending}
                  aria-label={`${accepted ? "Remove" : "Cancel invite for"} ${person.email ?? "link invite"}`}
                  onClick={() => {
                    if (
                      !accepted ||
                      window.confirm(`Remove ${person.email ?? "this instructor"}? They will lose access straight away.`)
                    )
                      remove.mutate(person.id);
                  }}
                >
                  {accepted ? "Remove" : "Cancel"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

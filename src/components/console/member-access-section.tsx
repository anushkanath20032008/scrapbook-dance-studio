import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { formatDayWithYear } from "@/lib/format";
import {
  createMemberInvite,
  listMemberAccess,
  removeMemberAccess,
  revokeMemberInvite,
} from "@/lib/members.functions";
import { accessStateOf, type AccessState } from "@/lib/member-access";

export const MEMBER_ACCESS_KEY = ["member-access"] as const;

/** A small badge for the dancer list: Joined, Invited, or nothing. */
export function useMemberAccess() {
  const listFn = useServerFn(listMemberAccess);
  const access = useQuery({
    queryKey: MEMBER_ACCESS_KEY,
    queryFn: () => listFn({ data: {} }),
  });
  return (guardianId: string | null | undefined): AccessState =>
    access.data && guardianId ? accessStateOf(access.data, guardianId) : { state: "none" };
}

export function AccessBadge({ state }: { state: AccessState }) {
  if (state.state === "none") return null;
  return (
    <span className="status-pill" data-tone={state.state === "joined" ? "good" : "idle"}>
      {state.state === "joined" ? "Joined" : "Invited"}
    </span>
  );
}

const expiryOptions = [
  { days: 7, label: "7 days" },
  { days: 1, label: "1 day" },
  { days: 30, label: "30 days" },
] as const;

/**
 * A dancer's own login. The owner makes an invite (link plus short code, shown once), sees whether the dancer
 * has joined, and can end the dancer's access at any time without deleting their record.
 */
export function MemberAccessSection({ guardianId }: { guardianId: string }) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createMemberInvite);
  const listFn = useServerFn(listMemberAccess);
  const revokeFn = useServerFn(revokeMemberInvite);
  const removeFn = useServerFn(removeMemberAccess);
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [created, setCreated] = useState<{ url: string; code: string; expiresAt: string } | null>(
    null,
  );
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  const access = useQuery({
    queryKey: [...MEMBER_ACCESS_KEY, guardianId],
    queryFn: () => listFn({ data: { guardianId } }),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: MEMBER_ACCESS_KEY });

  const create = useMutation({
    mutationFn: () => createFn({ data: { guardianId, days } }),
    onSuccess: (result) => {
      setCreated(result);
      setCopied("");
      setError("");
      refresh();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const revokeInvite = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      setCreated(null);
      setError("");
      refresh();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const removeAccess = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: (e) => setError(messageOf(e)),
  });

  const state: AccessState = access.data
    ? accessStateOf(access.data, guardianId)
    : { state: "none" };

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setCopied("");
    }
  }

  return (
    <>
      <h3>Dancer login</h3>
      <p className="console-hint">
        Invite the dancer to sign in with their own account to see their classes, attendance and
        fees, and to tell you when they have paid. The link and code are shown once and work one
        time.
      </p>
      {state.state === "joined" && (
        <p>
          <span className="status-pill" data-tone="good">
            Joined
          </span>{" "}
          <span className="console-hint">{formatDayWithYear(state.joinedAt.slice(0, 10))}</span>
        </p>
      )}
      {state.state === "invited" && !created && (
        <p>
          <span className="status-pill" data-tone="idle">
            Invited
          </span>{" "}
          <span className="console-hint">
            expires {formatDayWithYear(state.expiresAt.slice(0, 10))}
          </span>
        </p>
      )}
      {created && (
        <div className="link-box">
          <input
            className="field"
            readOnly
            value={created.url}
            aria-label="Invite link"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button variant="retroPaper" type="button" onClick={() => copy("link", created.url)}>
            {copied === "link" ? "Copied ✓" : "Copy link"}
          </Button>
          <input
            className="field"
            readOnly
            value={created.code}
            aria-label="Invite code"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button variant="retroPaper" type="button" onClick={() => copy("code", created.code)}>
            {copied === "code" ? "Copied ✓" : "Copy code"}
          </Button>
        </div>
      )}
      <div className="console-actions">
        {state.state !== "joined" && (
          <>
            <select
              className="field"
              aria-label="Invite lasts"
              value={days}
              onChange={(event) => setDays(Number(event.target.value) as 1 | 7 | 30)}
            >
              {expiryOptions.map((option) => (
                <option key={option.days} value={option.days}>
                  Lasts {option.label}
                </option>
              ))}
            </select>
            <Button
              variant="retroPaper"
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate()}
            >
              {state.state === "invited" ? "Replace invite" : "Invite to sign in"}
            </Button>
          </>
        )}
        {state.state === "invited" && (
          <Button
            variant="retroPaper"
            type="button"
            disabled={revokeInvite.isPending}
            onClick={() => revokeInvite.mutate(state.inviteId)}
          >
            Cancel invite
          </Button>
        )}
        {state.state === "joined" && (
          <Button
            variant="retroPaper"
            type="button"
            disabled={removeAccess.isPending}
            onClick={() => {
              if (window.confirm("Remove this dancer's login? Their record and history stay.")) {
                removeAccess.mutate(state.linkId);
              }
            }}
          >
            Remove access
          </Button>
        )}
      </div>
      <FormAlert message={error} />
    </>
  );
}

// Client-safe: how an owner reads a dancer's login state from the invite and membership status rows.

export type AccessRows = {
  invites: {
    id: string;
    guardian_id: string;
    expires_at: string;
    redeemed_at: string | null;
    revoked_at: string | null;
  }[];
  links: { id: string; guardian_id: string; revoked_at: string | null; created_at: string }[];
};

export type AccessState =
  | { state: "none" }
  | { state: "invited"; inviteId: string; expiresAt: string }
  | { state: "joined"; linkId: string; joinedAt: string };

/** One dancer's access state: joined beats invited beats none. A spent, revoked or expired invite is not shown. */
export function accessStateOf(
  access: AccessRows,
  guardianId: string,
  now: Date = new Date(),
): AccessState {
  const link = access.links.find(
    (row) => row.guardian_id === guardianId && row.revoked_at === null,
  );
  if (link) return { state: "joined", linkId: link.id, joinedAt: link.created_at };
  const invite = access.invites.find(
    (row) =>
      row.guardian_id === guardianId &&
      row.redeemed_at === null &&
      row.revoked_at === null &&
      new Date(row.expires_at) > now,
  );
  return invite
    ? { state: "invited", inviteId: invite.id, expiresAt: invite.expires_at }
    : { state: "none" };
}

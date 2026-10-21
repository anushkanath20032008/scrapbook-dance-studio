import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import {
  createTelegramInvite,
  getTelegramStatus,
  listTelegramLinks,
  revokeTelegramLink,
} from "@/lib/telegram.functions";

/** A private link that connects one dancer to the studio's Telegram bot, so reminders can reach them for free. */
export function TelegramLinkSection({ guardianId }: { guardianId: string }) {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getTelegramStatus);
  const createFn = useServerFn(createTelegramInvite);
  const listFn = useServerFn(listTelegramLinks);
  const revokeFn = useServerFn(revokeTelegramLink);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const status = useQuery({ queryKey: ["telegram-status"], queryFn: () => statusFn() });
  const links = useQuery({
    queryKey: ["telegram-links", guardianId],
    queryFn: () => listFn({ data: { guardianId } }),
    enabled: status.data?.configured === true,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["telegram-links", guardianId] });

  const create = useMutation({
    mutationFn: () => createFn({ data: { guardianId } }),
    onSuccess: ({ url: created }) => {
      setUrl(created);
      setCopied(false);
      setError("");
      refresh();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      setUrl("");
      refresh();
    },
    onError: (e) => setError(messageOf(e)),
  });

  if (!status.data?.configured) return null;

  const live = (links.data ?? []).filter((link) => link.revoked_at === null);
  const joined = live.some((link) => link.joined_at !== null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <h3>Telegram invite link</h3>
      <p className="console-hint">
        {joined
          ? "This dancer has joined the Telegram bot and can get free reminders there."
          : "Send this to the dancer privately. When they tap it and press Start, you can send them free reminders on Telegram. It works once, so do not post it in a group."}
      </p>
      {url && (
        <div className="link-box">
          <input
            className="field"
            readOnly
            value={url}
            aria-label="Telegram invite link"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button variant="retroPaper" type="button" onClick={copy}>
            {copied ? "Copied ✓" : "Copy"}
          </Button>
        </div>
      )}
      <div className="console-actions">
        <Button
          variant="retroPaper"
          type="button"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          {live.length > 0 ? "Create a new invite" : "Create invite"}
        </Button>
        {live.length > 0 && (
          <Button
            variant="retroPaper"
            type="button"
            disabled={revoke.isPending}
            onClick={() => {
              for (const link of live) revoke.mutate(link.id);
            }}
          >
            {joined ? "Disconnect Telegram" : "Revoke invite"}
          </Button>
        )}
      </div>
      <FormAlert message={error} />
    </>
  );
}

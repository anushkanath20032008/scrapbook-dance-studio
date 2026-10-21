import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { formatRupees } from "@/lib/money";
import { listTelegramRecipients, sendTelegramReminders } from "@/lib/telegram.functions";

/**
 * Free reminders through the studio's Telegram bot. The owner sees who has joined, picks the recipients and presses
 * Send; nothing goes out on its own. Dancers who have not joined need their invite link first (Dancers page).
 */
export function TelegramBatchDialog({
  open,
  onClose,
  period,
}: {
  open: boolean;
  onClose: () => void;
  period: string;
}) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listTelegramRecipients);
  const sendFn = useServerFn(sendTelegramReminders);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const recipients = useQuery({
    queryKey: ["telegram-recipients", period],
    queryFn: () => listFn({ data: { period } }),
    enabled: open,
  });
  const rows = recipients.data ?? [];
  const sendable = rows.filter((row) => row.joined && !row.reminded);
  const notJoined = rows.filter((row) => !row.joined);

  useEffect(() => {
    if (open) setPicked(new Set(sendable.map((row) => row.charge_id)));
    // Re-seed the ticks only when the list itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipients.data]);

  const send = useMutation({
    mutationFn: () => sendFn({ data: { period, chargeIds: [...picked] } }),
    onSuccess: (summary) => {
      setError("");
      const parts = [`Sent to ${summary.sent}`];
      if (summary.blocked) parts.push(`${summary.blocked} blocked the bot`);
      if (summary.failed) parts.push(`${summary.failed} failed`);
      if (summary.stopped) parts.push("Telegram asked us to slow down, try the rest in a minute");
      setResult(`${parts.join(", ")}.`);
      void queryClient.invalidateQueries({ queryKey: ["telegram-recipients", period] });
    },
    onError: (e) => setError(messageOf(e)),
  });

  const toggle = (chargeId: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(chargeId)) next.add(chargeId);
      return next;
    });

  return (
    <ConsoleDialog
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title="Remind on Telegram"
    >
      {recipients.isError && <p role="alert">Could not load the list. Please try again.</p>}
      {sendable.length > 0 ? (
        <>
          <p className="console-hint">
            Free. Tick who should get a reminder, then press Send. Each message has an &quot;I&apos;ve
            paid&quot; button; it only tells you, and you confirm in To verify.
          </p>
          <ul className="console-list">
            {sendable.map((row) => (
              <li key={row.charge_id} className="console-row">
                <label>
                  <input
                    type="checkbox"
                    checked={picked.has(row.charge_id)}
                    onChange={() => toggle(row.charge_id)}
                  />{" "}
                  <strong>{row.student_name}</strong>{" "}
                  <span className="console-hint">{formatRupees(row.outstanding_paise)} owed</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="console-form-actions">
            <Button
              variant="retro"
              type="button"
              disabled={picked.size === 0 || send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? "Sending…" : `Send to ${picked.size}`}
            </Button>
          </div>
        </>
      ) : (
        !recipients.isLoading && (
          <p role="status">
            {rows.some((row) => row.joined)
              ? "Everyone who joined was already reminded today."
              : "Nobody has joined the Telegram bot yet."}
          </p>
        )
      )}
      {result && (
        <p role="status" className="console-notice">
          ✓ {result}
        </p>
      )}
      <FormAlert message={error} />
      {notJoined.length > 0 && (
        <p className="console-hint">
          Not on Telegram yet: {notJoined.map((row) => row.student_name).join(", ")}. Open a dancer on the
          Dancers page and send them their Telegram invite link.
        </p>
      )}
      <div className="console-form-actions">
        <Button variant="retroPaper" type="button" onClick={onClose}>
          Close
        </Button>
      </div>
    </ConsoleDialog>
  );
}

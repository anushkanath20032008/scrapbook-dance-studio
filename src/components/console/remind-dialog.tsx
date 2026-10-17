import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { formatRupees } from "@/lib/money";
import { previewReminders, queueReminders } from "@/lib/reminders.functions";

/** Who to remind: one dancer, or everyone overdue for the month. */
export type RemindTarget = { period: string; studentId?: string; name?: string };

export function RemindDialog({
  target,
  onClose,
  onQueued,
}: {
  target: RemindTarget | null;
  onClose: () => void;
  onQueued: (message: string) => void;
}) {
  return (
    <ConsoleDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={target?.studentId ? `Remind ${target.name ?? "dancer"}` : "Remind everyone overdue"}
    >
      {target && <RemindForm target={target} onClose={onClose} onQueued={onQueued} />}
    </ConsoleDialog>
  );
}

function RemindForm({
  target,
  onClose,
  onQueued,
}: {
  target: RemindTarget;
  onClose: () => void;
  onQueued: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const preview = useServerFn(previewReminders);
  const queue = useServerFn(queueReminders);
  const [error, setError] = useState("");

  const choice = {
    period: target.period,
    ...(target.studentId ? { studentId: target.studentId } : { onlyOverdue: true }),
  };
  const recipients = useQuery({
    queryKey: ["reminder-preview", target.period, target.studentId ?? "all-overdue"],
    queryFn: () => preview({ data: choice }),
    staleTime: 0,
    gcTime: 0,
  });

  const mutation = useMutation({
    mutationFn: () => queue({ data: choice }),
    onSuccess: ({ queued }) => {
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
      onQueued(
        queued === 0
          ? "No new reminders were queued."
          : `${queued} reminder${queued === 1 ? "" : "s"} queued.`,
      );
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });

  const rows = recipients.data ?? [];
  const sendable = rows.filter((row) => row.skip_reason === null);
  const skipped = rows.filter((row) => row.skip_reason !== null);

  return (
    <div className="console-form">
      {recipients.isPending && <p>Checking who would be messaged…</p>}
      {recipients.isError && <p role="alert">Could not check the recipients. Please try again.</p>}
      {recipients.data && rows.length === 0 && (
        <p className="console-empty">Nobody is due a reminder for this month.</p>
      )}
      {sendable.length > 0 && (
        <>
          <p>
            <strong>{sendable.length} will be messaged</strong>
          </p>
          <ul className="console-list">
            {sendable.map((row) => (
              <li key={row.student_id} className="console-row">
                <div>
                  <strong>{row.student_name}</strong>
                  <span className="console-hint">{row.phone}</span>
                </div>
                <strong>{formatRupees(row.outstanding_paise)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
      {skipped.length > 0 && (
        <>
          <p>
            <strong>{skipped.length} skipped</strong>
          </p>
          <ul className="console-list">
            {skipped.map((row) => (
              <li key={row.student_id} className="console-row" data-archived="true">
                <strong>{row.student_name}</strong>
                <span className="status-pill" data-tone="idle">
                  {row.skip_reason}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <FormAlert message={error} />
      <div className="console-actions">
        <Button
          variant="retro"
          type="button"
          disabled={sendable.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Queue {sendable.length} reminder{sendable.length === 1 ? "" : "s"}
        </Button>
        <Button variant="retroPaper" type="button" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

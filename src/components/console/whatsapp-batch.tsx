import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { formatRupees } from "@/lib/money";
import { whatsappLink, type ReminderRow } from "@/lib/manual-reminders";

type Row = ReminderRow & { days_overdue?: number | null; status?: string };

/**
 * Walks the owner through the unpaid dancers one at a time: each tap opens that dancer's WhatsApp chat with the
 * reminder filled in. WhatsApp requires the owner to press Send, so nothing is sent from here.
 */
export function WhatsAppBatchDialog({
  open,
  onClose,
  rows,
  studioName,
  reminded,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  rows: Row[];
  studioName: string;
  reminded: Set<string>;
  onOpened: (chargeId: string) => void;
}) {
  const { usable, noPhone } = useMemo(() => {
    const withLink = rows.map((row) => ({ row, link: whatsappLink(row, studioName) }));
    return {
      usable: withLink.filter((item): item is { row: Row; link: string } => item.link !== null),
      noPhone: withLink.filter((item) => item.link === null).map((item) => item.row),
    };
  }, [rows, studioName]);
  const remaining = usable.filter((item) => !reminded.has(item.row.charge_id));
  const next = remaining[0];

  return (
    <ConsoleDialog open={open} onOpenChange={(value) => !value && onClose()} title="Remind on WhatsApp">
      {next ? (
        <>
          <p className="console-hint">
            {remaining.length} left. Open each chat, press Send in WhatsApp, then come back for the next.
          </p>
          <div className="console-row">
            <div>
              <strong>{next.row.student_name}</strong>
              <span className="console-hint">
                {next.row.phone} · {formatRupees(next.row.outstanding_paise)} owed
              </span>
            </div>
          </div>
          <div className="console-form-actions">
            <Button asChild variant="retro">
              <a
                href={next.link}
                target="_blank"
                rel="noreferrer"
                onClick={() => onOpened(next.row.charge_id)}
              >
                Open WhatsApp for {next.row.student_name}
              </a>
            </Button>
            <Button variant="retroPaper" type="button" onClick={() => onOpened(next.row.charge_id)}>
              Skip
            </Button>
          </div>
        </>
      ) : (
        <p role="status">
          {usable.length === 0
            ? "Nobody here has a usable phone number."
            : `✓ All done. You opened a reminder for ${usable.length} dancer${usable.length === 1 ? "" : "s"} today.`}
        </p>
      )}
      {noPhone.length > 0 && (
        <p className="console-hint">
          No usable phone number for {noPhone.map((row) => row.student_name).join(", ")}. Add one on the Dancers
          page.
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

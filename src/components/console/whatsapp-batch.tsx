import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { formatRupees } from "@/lib/money";
import { reminderText, whatsappLink, type ReminderRow } from "@/lib/manual-reminders";

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
  const openLink = useRef<HTMLAnchorElement>(null);
  const nextId = next?.row.charge_id;
  // Put focus on the one useful button, so Enter opens the next chat. Radix focuses the dialog first, so wait a beat.
  useEffect(() => {
    if (!open || !nextId) return;
    const timer = setTimeout(() => openLink.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open, nextId]);
  const position = usable.length - remaining.length + 1;

  return (
    <ConsoleDialog open={open} onOpenChange={(value) => !value && onClose()} title="Remind on WhatsApp">
      {next ? (
        <>
          <p className="console-hint">
            {position} of {usable.length}. This opens your own WhatsApp with the message ready. Press Send
            there, then come back here for the next one.
          </p>
          <div className="console-row">
            <div>
              <strong>{next.row.student_name}</strong>
              <span className="console-hint">
                {next.row.phone} · {formatRupees(next.row.outstanding_paise)} owed
              </span>
            </div>
          </div>
          <blockquote className="reminder-preview">{reminderText(next.row, studioName)}</blockquote>
          <div className="console-form-actions">
            <Button asChild variant="retro">
              <a
                href={next.link}
                target="_blank"
                rel="noreferrer"
                ref={openLink}
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
            : "✓ All done for today. Dancers you open or skip show as reminded."}
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
          {next ? "Stop here" : "Close"}
        </Button>
      </div>
    </ConsoleDialog>
  );
}

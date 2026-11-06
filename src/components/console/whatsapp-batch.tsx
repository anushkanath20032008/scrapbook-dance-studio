import { maskPhone } from "@/lib/format";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { getReminderLinks } from "@/lib/family.functions";
import { formatRupees } from "@/lib/money";
import { reminderText, whatsappLink, type ReminderRow } from "@/lib/manual-reminders";

type Row = ReminderRow & { student_id?: string; days_overdue?: number | null; status?: string };

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
  explicit = false,
}: {
  open: boolean;
  onClose: () => void;
  rows: Row[];
  studioName: string;
  reminded: Set<string>;
  onOpened: (chargeId: string) => void;
  /** True when the owner picked these dancers by name. Then "reminded earlier today" does not hide them. */
  explicit?: boolean;
}) {
  const fetchLinks = useServerFn(getReminderLinks);
  const [payLinks, setPayLinks] = useState<Record<string, string>>({});
  // Dancers handled since this window opened, so a dancer picked by name still moves on after one tap.
  const [handled, setHandled] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setHandled(new Set());
  }, [open]);
  // Keyed by the ids, not the array: callers build a new array on every render, which would refetch forever.
  const idsKey = rows.map((row) => row.student_id ?? "").join(",");
  // Each dancer's private "I paid" link is made once and goes into the message.
  useEffect(() => {
    if (!open) return;
    const studentIds = idsKey.split(",").filter(Boolean).slice(0, 200);
    if (studentIds.length === 0) return;
    let cancelled = false;
    fetchLinks({ data: { studentIds } })
      .then((links) => {
        if (!cancelled) setPayLinks(links);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idsKey]);
  const payLinkFor = (row: Row) => (row.student_id ? (payLinks[row.student_id] ?? null) : null);

  const { usable, noPhone } = useMemo(() => {
    const withLink = rows.map((row) => ({
      row,
      link: whatsappLink(row, studioName, payLinkFor(row)),
    }));
    return {
      usable: withLink.filter((item): item is { row: Row; link: string } => item.link !== null),
      noPhone: withLink.filter((item) => item.link === null).map((item) => item.row),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, studioName, payLinks]);
  const isDone = (chargeId: string) =>
    handled.has(chargeId) || (!explicit && reminded.has(chargeId));
  const remaining = usable.filter((item) => !isDone(item.row.charge_id));
  // Opening a chat is not sending a message: WhatsApp cannot tell us whether Send was pressed, so the owner
  // says so. Skipped dancers move on without being counted as reminded.
  const [openedId, setOpenedId] = useState<string | null>(null);
  const markDone = (chargeId: string, sent: boolean) => {
    setHandled((current) => new Set(current).add(chargeId));
    setOpenedId(null);
    if (sent) onOpened(chargeId);
  };
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
    <ConsoleDialog
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title="Remind on WhatsApp"
    >
      {next ? (
        <>
          <p className="console-hint">
            {position} of {usable.length}. This opens your own WhatsApp with the message ready.
            Press Send in WhatsApp, then come back and press "Sent it" so this dancer is counted.
          </p>
          <div className="console-row">
            <div>
              <strong>{next.row.student_name}</strong>
              <span className="console-hint">
                {maskPhone(next.row.phone)} · {formatRupees(next.row.outstanding_paise)} owed
              </span>
            </div>
          </div>
          <blockquote className="reminder-preview">
            {reminderText(next.row, studioName, undefined, payLinkFor(next.row))}
          </blockquote>
          <div className="console-form-actions">
            <Button asChild variant="retro">
              <a
                href={next.link}
                target="_blank"
                rel="noreferrer"
                ref={openLink}
                onClick={() => setOpenedId(next.row.charge_id)}
              >
                Open WhatsApp for {next.row.student_name}
              </a>
            </Button>
            {openedId === next.row.charge_id && (
              <Button
                variant="retro"
                type="button"
                onClick={() => markDone(next.row.charge_id, true)}
              >
                Sent it · next
              </Button>
            )}
            <Button
              variant="retroPaper"
              type="button"
              onClick={() => markDone(next.row.charge_id, false)}
            >
              Skip
            </Button>
          </div>
        </>
      ) : (
        <p role="status">
          {usable.length === 0
            ? "Nobody here has a usable phone number."
            : "✓ All done for today. Only the dancers you marked as sent are counted as reminded."}
        </p>
      )}
      {noPhone.length > 0 && (
        <p className="console-hint">
          No usable phone number for {noPhone.map((row) => row.student_name).join(", ")}. Add one on
          the Dancers page.
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

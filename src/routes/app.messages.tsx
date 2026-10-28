import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { messageOf } from "@/components/console/form-utils";
import {
  getAutomation,
  getMessagingStatus,
  listReminders,
  setAutomation,
} from "@/lib/reminders.functions";
import { formatRupees } from "@/lib/money";

export const Route = createFileRoute("/app/messages")({
  head: () => ({ meta: [{ title: "Messages | ChoreoStudio" }] }),
  component: Messages,
});

type Status = "queued" | "sending" | "sent" | "failed";
const filters: { value: Status | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];
const tone = (status: string) =>
  status === "sent" || status === "delivered" || status === "read"
    ? "good"
    : status === "failed"
      ? "warn"
      : "idle";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

type Payload = { student_name?: string; amount_paise?: number };

function Messages() {
  const listFn = useServerFn(listReminders);
  const statusFn = useServerFn(getMessagingStatus);
  const autoFn = useServerFn(getAutomation);
  const setAutoFn = useServerFn(setAutomation);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status | "">("");
  const [autoError, setAutoError] = useState("");

  const reminders = useQuery({
    queryKey: ["reminders", status],
    queryFn: () => listFn({ data: status ? { status } : {} }),
  });
  const messaging = useQuery({ queryKey: ["messaging-status"], queryFn: () => statusFn() });
  const automation = useQuery({ queryKey: ["whatsapp-automation"], queryFn: () => autoFn() });
  const toggle = useMutation({
    mutationFn: (on: boolean) => setAutoFn({ data: { on } }),
    onSuccess: () => {
      setAutoError("");
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-automation"] });
    },
    onError: (e) => setAutoError(messageOf(e)),
  });
  const automationLive = messaging.data?.providerConfigured === true;

  return (
    <section>
      <h1 className="display console-title">Messages</h1>
      {messaging.data && !messaging.data.providerConfigured && (
        <p className="console-warning" role="status">
          Automatic WhatsApp sending isn&apos;t switched on. Reminders are not sent by the app: use the
          WhatsApp buttons on Overview, which open your own WhatsApp with the message filled in.
        </p>
      )}
      <div className="window">
        <div className="window-bar chrome-font">Automatic WhatsApp (Studio+)</div>
        <div className="window-inner">
          {!automationLive ? (
            <p>Automatic WhatsApp is not switched on yet. Until it is, send reminders with the WhatsApp buttons on Overview.</p>
          ) : !automation.data?.studioPlus ? (
            <p>Automatic WhatsApp reminders come with Studio+. Until then, send them with the WhatsApp buttons on Overview.</p>
          ) : (
            <>
              <p>
                {automation.data.enabled
                  ? "On. Reminders you queue are sent from the ChoreoStudio WhatsApp number."
                  : "Off. Turn it on to have queued reminders sent from the ChoreoStudio WhatsApp number."}
              </p>
              <div className="console-actions">
                <Button
                  variant="retro"
                  type="button"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate(!automation.data?.enabled)}
                >
                  {automation.data.enabled ? "Turn off" : "Turn on"}
                </Button>
              </div>
              {autoError && <p role="alert">{autoError}</p>}
            </>
          )}
        </div>
      </div>
      <div className="console-toolbar" role="group" aria-label="Filter by status">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className="console-day"
            aria-pressed={status === filter.value}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {reminders.isPending && <p className="console-hint">Loading…</p>}
      {reminders.isError && <p role="alert">Could not load your messages. Please refresh.</p>}
      {reminders.data?.length === 0 && (
        <p className="console-empty">
          Nothing queued yet.{" "}
          <Link to="/app" className="setup-go">
            Go to Overview
          </Link>
        </p>
      )}
      <ul className="console-list">
        {reminders.data?.map((reminder) => {
          const payload = (reminder.payload ?? {}) as Payload;
          return (
            <li key={reminder.id} className="console-row">
              <div>
                <strong>{payload.student_name ?? "Dancer"}</strong>
                <span className="console-hint">
                  {reminder.kind === "fee_overdue" ? "Overdue reminder" : "Due reminder"}
                  {typeof payload.amount_paise === "number"
                    ? ` · ${formatRupees(payload.amount_paise)}`
                    : ""}
                  {" · "}
                  {reminder.delivered_at
                    ? `${reminder.delivery_status ?? "delivered"} ${when(reminder.delivered_at)}`
                    : reminder.sent_at
                    ? `sent ${when(reminder.sent_at)}`
                    : `queued ${when(reminder.created_at)}`}
                  {reminder.attempts > 0
                    ? ` · ${reminder.attempts} attempt${reminder.attempts === 1 ? "" : "s"}`
                    : ""}
                </span>
                {reminder.last_error && (
                  <span className="console-field-error">{reminder.last_error}</span>
                )}
              </div>
              <span className="status-pill" data-tone={tone(reminder.delivery_status ?? reminder.status)}>
                {reminder.status === "queued" && messaging.data && !messaging.data.providerConfigured
                  ? "not sent"
                  : (reminder.delivery_status ?? reminder.status)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

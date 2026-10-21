import { formatRupees } from "@/lib/money";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { setupCountsKey } from "@/components/console/console-data";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { MonthTotals } from "@/components/console/month-totals";
import { SetupChecklist } from "@/components/console/setup-checklist";
import { RecordPaymentDialog, type PayingStudent } from "@/components/console/record-payment";
import { RemindDialog, type RemindTarget } from "@/components/console/remind-dialog";
import { UnpaidList } from "@/components/console/unpaid-list";
import { WhatsAppBatchDialog } from "@/components/console/whatsapp-batch";
import { getConsoleContext } from "@/lib/console.functions";
import { markReminded, remindedToday } from "@/lib/manual-reminders";
import { getMessagingStatus } from "@/lib/reminders.functions";
import { formatMonthLong } from "@/lib/format";
import { generateCharges } from "@/lib/ledger.functions";
import { getHomeReport } from "@/lib/reports.functions";
import { buildSetupSteps, setupProgress } from "@/lib/setup-progress";
import { getSetupCounts } from "@/lib/setup.functions";
import { firstOfMonth, todayInIndia } from "@/lib/validators";

export const Route = createFileRoute("/app/")({
  component: Overview,
});

function Overview() {
  const queryClient = useQueryClient();
  const loadReport = useServerFn(getHomeReport);
  const generate = useServerFn(generateCharges);
  const loadCounts = useServerFn(getSetupCounts);

  const [month, setMonth] = useState(todayInIndia().slice(0, 7));
  const period = firstOfMonth(`${month}-01`);
  const [dueOn, setDueOn] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [paying, setPaying] = useState<PayingStudent | null>(null);
  const [reminding, setReminding] = useState<RemindTarget | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [reminded, setReminded] = useState<Set<string>>(new Set());
  const today = todayInIndia();
  useEffect(() => setReminded(remindedToday(today)), [today]);
  const loadContext = useServerFn(getConsoleContext);
  const context = useQuery({ queryKey: ["console-context"], queryFn: () => loadContext() });
  const studioName = context.data?.studioName ?? "";
  const loadMessaging = useServerFn(getMessagingStatus);
  const messaging = useQuery({ queryKey: ["messaging-status"], queryFn: () => loadMessaging() });
  const providerConfigured = messaging.data?.providerConfigured === true;
  const markOpened = (chargeId: string) => setReminded(new Set(markReminded(chargeId, today)));

  const report = useQuery({
    queryKey: ["home-report", period],
    queryFn: () => loadReport({ data: { period } }),
  });
  const counts = useQuery({ queryKey: setupCountsKey, queryFn: () => loadCounts() });
  const setupDone = counts.data ? setupProgress(buildSetupSteps(counts.data)).complete : false;

  const generateMutation = useMutation({
    mutationFn: () => generate({ data: { period, ...(dueOn ? { dueOn } : {}) } }),
    onSuccess: ({ created }) => {
      setError("");
      setNotice(
        created === 0
          ? "No charges created. Dancers need a monthly fee that covers this month."
          : `${created} charge${created === 1 ? "" : "s"} created for ${formatMonthLong(period)}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["home-report"] });
    },
    onError: (e) => setError(messageOf(e)),
  });

  const snapshot = report.data?.snapshot;
  const unpaidRows = report.data?.unpaid ?? [];
  const unpaidTotal = unpaidRows.reduce((sum, row) => sum + Number(row.outstanding_paise), 0);
  const needsCharges = snapshot !== undefined && snapshot.charged_students === 0;
  const defaultDue = `${month}-05`;

  return (
    <section>
      <h1 className="display console-title">Overview</h1>
      <div className="console-toolbar">
        <label className="console-inline-label">
          Month
          <input
            className="field month-field"
            type="month"
            value={month}
            onChange={(event) => {
              if (event.target.value) {
                setMonth(event.target.value);
                setDueOn("");
                setNotice("");
                setError("");
              }
            }}
          />
        </label>
      </div>

      {report.isError && <p role="alert">Could not load this month. Please refresh.</p>}
      {snapshot && <MonthTotals snapshot={snapshot} />}

      {unpaidRows.length > 0 && (
        <div className="console-banner" role="status">
          <span>
            <strong>
              {unpaidRows.length} unpaid
            </strong>{" "}
            · {formatRupees(unpaidTotal)} owed this month
          </span>
          <Button
            variant="retro"
            type="button"
            onClick={() => (providerConfigured ? setReminding({ period, allUnpaid: true }) : setBatchOpen(true))}
          >
            {providerConfigured ? "Remind all unpaid" : "Remind on WhatsApp"}
          </Button>
        </div>
      )}

      {needsCharges && (
        <div className="window generate-card">
          <div className="window-bar chrome-font">Charges.dialog</div>
          <div className="window-inner console-form">
            <p>
              <strong>{formatMonthLong(period)}</strong> has no charges yet.
              {snapshot.active_students === 0 && " Add dancers with a monthly fee first."}
            </p>
            <label className="form-label console-field">
              Due date
              <input
                className="field month-field"
                type="date"
                value={dueOn || defaultDue}
                min={`${month}-01`}
                onChange={(event) => setDueOn(event.target.value)}
              />
            </label>
            <div className="console-actions">
              <Button
                variant="retro"
                type="button"
                disabled={generateMutation.isPending || snapshot.active_students === 0}
                onClick={() => generateMutation.mutate()}
              >
                Generate {formatMonthLong(period)} charges
              </Button>
              {snapshot.active_students === 0 && (
                <Link to="/app/students" className="setup-go">
                  Add dancers
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className="console-notice">
          ✓ {notice}
        </p>
      )}
      <FormAlert message={error} />

      {snapshot && snapshot.charged_students > 0 && (
        <>
          <div className="console-list-head">
            <h2>Who hasn&apos;t paid</h2>
            {providerConfigured && (
              <Button
                variant="retroPaper"
                type="button"
                onClick={() => setReminding({ period })}
                disabled={snapshot.overdue_paise === 0}
              >
                Remind everyone overdue
              </Button>
            )}
          </div>
          <UnpaidList
            rows={report.data?.unpaid ?? []}
            onRecord={(row) => setPaying({ id: row.student_id, name: row.student_name })}
            onRemind={(row) =>
              setReminding({ period, studentId: row.student_id, name: row.student_name })
            }
            studioName={studioName}
            reminded={reminded}
            onOpened={markOpened}
            showQueue={providerConfigured}
          />
        </>
      )}

      <WhatsAppBatchDialog
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        rows={unpaidRows}
        studioName={studioName}
        reminded={reminded}
        onOpened={markOpened}
      />
      <RemindDialog
        target={reminding}
        onClose={() => setReminding(null)}
        onQueued={(message) => {
          setError("");
          setNotice(message);
        }}
      />
      <RecordPaymentDialog
        student={paying}
        onClose={() => setPaying(null)}
        onSaved={(message) => {
          setError("");
          setNotice(message);
        }}
      />

      {!setupDone && (
        <div className="window setup-card">
          <div className="window-bar chrome-font">Setup.dialog</div>
          <div className="window-inner">
            <SetupChecklist />
          </div>
        </div>
      )}
    </section>
  );
}

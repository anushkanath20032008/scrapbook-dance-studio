import { formatRupees } from "@/lib/money";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setupCountsKey } from "@/components/console/console-data";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { MonthCharts } from "@/components/console/month-charts";
import { MonthTotals } from "@/components/console/month-totals";
import { usePasteResult } from "@/components/console/paste-dancers";
import { SetupChecklist } from "@/components/console/setup-checklist";
import { RecordPaymentDialog, type PayingStudent } from "@/components/console/record-payment";
import { RemindDialog, type RemindTarget } from "@/components/console/remind-dialog";
import { WhatsAppBatchDialog } from "@/components/console/whatsapp-batch";
import { StudioTable, TeacherTable } from "@/components/console/studio-table";
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
  head: () => ({ meta: [{ title: "Home | ChoreoStudio" }] }),
  component: Home,
});

/** Teachers get their own home of tiles; the owner gets the month overview with tiles above it. */
function Home() {
  const loadContext = useServerFn(getConsoleContext);
  const context = useQuery({ queryKey: ["console-context"], queryFn: () => loadContext() });
  if (context.data?.role === "instructor") return <TeacherHome />;
  if (!context.data) return null;
  return <Overview />;
}

function TeacherHome() {
  return (
    <section>
      <h1 className="display console-title">Home</h1>
      <p className="console-hint">Your batches and dancers. Tick who is here today.</p>
      <TeacherTable today={todayInIndia()} />
    </section>
  );
}

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
  const [remindIds, setRemindIds] = useState<string[] | null>(null);
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
  // A studio with no dancers yet sees the setup card first, with the paste box in it.
  const [pasted] = usePasteResult();
  const firstRun = counts.data?.students === 0 || pasted !== null;

  const generateMutation = useMutation({
    mutationFn: () => generate({ data: { period, ...(dueOn ? { dueOn } : {}) } }),
    onSuccess: ({ created }) => {
      setError("");
      if (created === 0) setNotice("No charges created. Dancers need a monthly fee that covers this month.");
      else
        toast.success(
          `${created} charge${created === 1 ? "" : "s"} created for ${formatMonthLong(period)}.`,
        );
      void queryClient.invalidateQueries({ queryKey: ["home-report"] });
    },
    onError: (e) => setError(messageOf(e)),
  });

  const snapshot = report.data?.snapshot;
  const unpaidRows = report.data?.unpaid ?? [];
  const arrears = report.data?.arrears ?? [];
  const arrearsTotal = arrears.reduce((sum, row) => sum + Number(row.outstanding_paise), 0);
  const awaitingFee = report.data?.awaitingFee ?? 0;
  const unpaidTotal = unpaidRows.reduce((sum, row) => sum + Number(row.outstanding_paise), 0);
  const needsCharges = snapshot !== undefined && snapshot.charged_students === 0;
  // A studio with no dancers has nothing to total or charge yet: the start card is the whole page.
  const optionalLeft = counts.data ? counts.data.batches === 0 : false;
  const brandNew = counts.data?.students === 0;
  const defaultDue = `${month}-05`;

  return (
    <section>
      <h1 className="display console-title">Home</h1>
      {!brandNew && (
        <StudioTable
          period={period}
          today={today}
          onRecord={(student) => setPaying(student)}
          onRemindBatch={(ids) => {
            setRemindIds(ids);
            setBatchOpen(true);
          }}
        />
      )}
      {unpaidRows.length > 0 && (
        <div className="console-banner" data-tone="overdue" role="status">
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
      {firstRun && !setupDone && (
        <div className="window setup-card">
          <div className="window-bar chrome-font">Start here.dialog</div>
          <div className="window-inner">
            <h2 className="setup-first-title">
              {pasted ? "Your studio is set up." : "Add your dancers to get started."}
            </h2>
            <SetupChecklist />
          </div>
        </div>
      )}
      {firstRun && setupDone && optionalLeft && (
        <p className="console-banner setup-slim" role="status">
          <span>✓ Setup done. Optional: add your batches so you can mark attendance.</span>
          <Link to="/app/batches" className="setup-go">
            Add batches
          </Link>
        </p>
      )}
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

      {report.isPending && <p className="console-empty">Loading this month…</p>}
      {report.isError && <p role="alert">Could not load this month. Please refresh.</p>}
      {snapshot && !brandNew && <MonthTotals snapshot={snapshot} />}
      {snapshot && !brandNew && <MonthCharts snapshot={snapshot} />}

      {arrears.length > 0 && (
        <p className="console-banner" role="status">
          <span>
            <strong>{formatRupees(arrearsTotal)}</strong> is still unpaid from earlier months across{" "}
            {arrears.length} dancer{arrears.length === 1 ? "" : "s"}. This month&apos;s list below does
            not include it: open a dancer&apos;s billing to see and record it.
          </span>
        </p>
      )}

      {needsCharges && !brandNew && (
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
      {snapshot && snapshot.charged_students > 0 && awaitingFee > 0 && (
        <div className="console-banner" role="status">
          <span>
            <strong>
              {awaitingFee} dancer{awaitingFee === 1 ? "" : "s"}
            </strong>{" "}
            {awaitingFee === 1 ? "has" : "have"} no fee for {formatMonthLong(period)} yet. A dancer
            needs a monthly fee first.
          </span>
          <span className="console-banner-actions">
            <Link to="/app/students" className="setup-go">
              Set fees
            </Link>
            <Button
              variant="retro"
              type="button"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              Create their fees
            </Button>
          </span>
        </div>
      )}
      {notice && (
        <p role="status" className="console-notice">
          ✓ {notice}
        </p>
      )}
      <FormAlert message={error} />

      <WhatsAppBatchDialog
        open={batchOpen}
        onClose={() => {
          setBatchOpen(false);
          setRemindIds(null);
        }}
        rows={remindIds ? unpaidRows.filter((row) => remindIds.includes(row.student_id)) : unpaidRows}
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
        onSaved={() => setError("")}
      />
    </section>
  );
}

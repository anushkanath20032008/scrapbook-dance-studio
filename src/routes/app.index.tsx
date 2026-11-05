import { formatRupees } from "@/lib/money";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setupCountsKey } from "@/components/console/console-data";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { MonthCharts } from "@/components/console/month-charts";
import { MonthStrip } from "@/components/console/month-strip";
import { usePasteResult } from "@/components/console/paste-dancers";
import { SetupChecklist } from "@/components/console/setup-checklist";
import { RecordPaymentDialog, type PayingStudent } from "@/components/console/record-payment";
import { RemindDialog, type RemindTarget } from "@/components/console/remind-dialog";
import { WhatsAppBatchDialog } from "@/components/console/whatsapp-batch";
import { DancerBoard } from "@/components/console/dancer-board";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { ImportSheet } from "@/components/console/import-sheet";
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
import { sampleBatches, sampleNumbers, samplePay, isSampleId } from "@/lib/sample-studio";
import type { TableBatch } from "@/lib/studio-table";

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
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // A made-up studio for practising and demos; null means the real one is showing.
  const [sample, setSample] = useState<TableBatch[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState<"table" | "cards" | "batches" | "charts">("table");
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
      if (created === 0)
        setNotice("No charges created. Dancers need a monthly fee that covers this month.");
      else
        toast.success(
          `${created} charge${created === 1 ? "" : "s"} created for ${formatMonthLong(period)}.`,
        );
      void queryClient.invalidateQueries({ queryKey: ["home-report"] });
    },
    onError: (e) => setError(messageOf(e)),
  });

  const snapshot = report.data?.snapshot;
  const unpaidRows = useMemo(() => report.data?.unpaid ?? [], [report.data]);
  const arrears = report.data?.arrears ?? [];
  const arrearsTotal = arrears.reduce((sum, row) => sum + Number(row.outstanding_paise), 0);
  const awaitingFee = report.data?.awaitingFee ?? 0;
  const awaitingNames = report.data?.awaitingNames ?? [];
  const unpaidTotal = unpaidRows.reduce((sum, row) => sum + Number(row.outstanding_paise), 0);
  // Dancers who owe but sit in no batch: the board builds itself from batches, so they arrive this way.
  const looseUnpaid = useMemo(
    () =>
      unpaidRows.map((row) => ({
        studentId: row.student_id,
        name: row.student_name,
        outstandingPaise: Number(row.outstanding_paise),
        feePaise: Number(row.amount_paise),
        status: (row.status === "overdue" ? "overdue" : "due") as "overdue" | "due",
      })),
    [unpaidRows],
  );
  // The board keys dancers by student; the reminder log keys them by charge.
  const remindedStudents = useMemo(
    () =>
      new Set(unpaidRows.filter((row) => reminded.has(row.charge_id)).map((row) => row.student_id)),
    [unpaidRows, reminded],
  );
  const dialogRows = useMemo(
    () => (remindIds ? unpaidRows.filter((row) => remindIds.includes(row.student_id)) : unpaidRows),
    [remindIds, unpaidRows],
  );
  const needsCharges = snapshot !== undefined && snapshot.charged_students === 0;
  // A studio with no dancers has nothing to total or charge yet: the start card is the whole page.
  const optionalLeft = counts.data ? counts.data.batches === 0 : false;
  const brandNew = counts.data?.students === 0;
  const defaultDue = `${month}-05`;

  return (
    <section>
      <div className="home-head">
        <h1 className="home-title">Home</h1>
        {!sample && !brandNew && (
          <div className="table-chips home-views" role="group" aria-label="View">
            {(
              [
                ["table", "Table"],
                ["cards", "Cards"],
                ["batches", "By batch"],
                ["charts", "Charts"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="table-chip"
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="home-head-right">
          {!sample && (
            <button type="button" className="board-secondary" onClick={() => setImportOpen(true)}>
              Import Excel / CSV
            </button>
          )}
          <button
            type="button"
            className="board-secondary"
            data-tour="sample"
            onClick={() => {
              setPicked(new Set());
              setSample(sample ? null : sampleBatches());
            }}
          >
            {sample ? "Back to my studio" : "Try with sample dancers"}
          </button>
          <label className="board-bar-label">
            Month
            <input
              className="board-input"
              type="month"
              value={month}
              onChange={(event) => {
                if (event.target.value) {
                  setMonth(event.target.value);
                  setDueOn("");
                  setNotice("");
                  setError("");
                  setPicked(new Set());
                }
              }}
            />
          </label>
        </div>
      </div>
      {sample && (
        <p className="console-banner sample-banner" role="status">
          Sample studio: eight made-up dancers. Tick, select and record payments to practise.
          Nothing is saved or sent.
        </p>
      )}
      {(!brandNew || sample) && (
        <>
          {sample ? (
            <MonthStrip numbers={sampleNumbers(sample)} arrearsPaise={0} arrearsLink={false} />
          ) : (
            snapshot && (
              <MonthStrip
                numbers={{
                  missing_paise: Number(snapshot.missing_paise),
                  overdue_paise: Number(snapshot.overdue_paise),
                  billed_paise: Number(snapshot.billed_paise),
                  collected_paise: Number(snapshot.collected_paise),
                  paid_students: snapshot.paid_students,
                  charged_students: snapshot.charged_students,
                  active_students: snapshot.active_students,
                  ongoing_batches: snapshot.ongoing_batches,
                }}
                arrearsPaise={arrearsTotal}
              />
            )
          )}
          {(sample || view === "table" || view === "cards") && (
            <DancerBoard
              layout={view === "cards" && !sample ? "cards" : "table"}
              period={period}
              today={today}
              loose={looseUnpaid}
              reminded={remindedStudents}
              picked={picked}
              onPickedChange={setPicked}
              sample={sample}
              onSampleChange={setSample}
              onRecord={(student) => {
                if (sample && isSampleId(student.id)) setSample(samplePay(sample, student.id));
                else setPaying(student);
              }}
              onRemindMany={(ids) => {
                setRemindIds(ids);
                setBatchOpen(true);
              }}
              onWhatsApp={(studentId) => {
                setRemindIds([studentId]);
                setBatchOpen(true);
              }}
            />
          )}
          {!sample && view === "table" && providerConfigured && unpaidRows.length > 0 && (
            <div className="home-auto">
              <button
                type="button"
                className="board-secondary"
                onClick={() => setReminding({ period, allUnpaid: true })}
              >
                Queue automatic reminders
              </button>
            </div>
          )}
        </>
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
      {report.isError && <p role="alert">Could not load this month. Please refresh.</p>}

      {needsCharges && !brandNew && !sample && (
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
      {!sample && snapshot && snapshot.charged_students > 0 && awaitingFee > 0 && (
        <div className="console-banner" role="status">
          <span>
            <strong>
              {awaitingFee} dancer{awaitingFee === 1 ? "" : "s"}
            </strong>
            {awaitingNames.length > 0 && (
              <>
                {" "}
                ({awaitingNames.slice(0, 5).join(", ")}
                {awaitingNames.length > 5 ? "…" : ""})
              </>
            )}{" "}
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

      {!brandNew && !sample && view === "batches" && (
        <>
          <StudioTable
            period={period}
            today={today}
            onRecord={(student) => setPaying(student)}
            onRemindBatch={(ids) => {
              setRemindIds(ids);
              setBatchOpen(true);
            }}
          />
        </>
      )}
      {snapshot && !brandNew && !sample && view === "charts" && <MonthCharts snapshot={snapshot} />}

      <ConsoleDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import from Excel or CSV"
      >
        {importOpen && <ImportSheet onDone={() => setImportOpen(false)} />}
      </ConsoleDialog>
      <WhatsAppBatchDialog
        open={batchOpen}
        onClose={() => {
          setBatchOpen(false);
        }}
        rows={dialogRows}
        explicit={remindIds !== null}
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

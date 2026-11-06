import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { ImportSheet } from "@/components/console/import-sheet";
import { useRefreshMoney, useRefreshStudents } from "@/components/console/console-data";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { bulkAddDancers } from "@/lib/bulk-dancers.functions";
import { getImportCapabilities, readDancersFromPhoto } from "@/lib/photo-import.functions";
import { suggestFeeRupees } from "@/lib/bulk-dancers";
import { DancerGrid, startRows } from "@/components/console/dancer-grid";
import { addableFromGrid, checkGrid, pasteIntoGrid, type GridRow } from "@/lib/dancer-grid";
import { listFeePlans } from "@/lib/fees.functions";
import { getProfile, saveProfile } from "@/lib/profile.functions";
import { formatDay } from "@/lib/format";
import { formatRupees, parseRupees } from "@/lib/money";
import { firstOfMonth, todayInIndia } from "@/lib/validators";

export type PasteResult = {
  added: number;
  skipped: number;
  charged: number;
  billed: boolean;
  dueOn: string;
};
const pasteResultKey = ["paste-result"] as const;

/**
 * The outcome of the last paste, kept in the query cache so it survives the screen around it changing: the moment
 * the first dancer is added the studio is no longer empty, and the card that held the form would otherwise vanish
 * before the owner has seen what happened.
 */
export function usePasteResult() {
  const queryClient = useQueryClient();
  const query = useQuery<PasteResult | null>({
    queryKey: pasteResultKey,
    queryFn: () => null,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return [
    query.data,
    (result: PasteResult | null) => queryClient.setQueryData(pasteResultKey, result),
  ] as const;
}

/** Shrinks a photo to at most 1800 px on its long side and returns JPEG base64, so a phone photo fits the limit. */
async function photoToBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "";
}

/** The studio's due day this month, or today once it has gone, so the first reminders do not read as long overdue. */
function defaultDueDate(today: string, dueDay: number): string {
  const month = firstOfMonth(today);
  const last = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  const day = `${month.slice(0, 8)}${String(Math.min(dueDay, last)).padStart(2, "0")}`;
  return day >= today ? day : today;
}

/**
 * Paste a list, check it, add everyone. The fastest way to fill a new studio: one fee for everyone (or a fee after
 * a name), this month's charges created in the same step, and no fee plans or batches to set up first.
 */
export function PasteDancers({ onDone }: { onDone?: () => void }) {
  const refresh = useRefreshStudents();
  const refreshMoney = useRefreshMoney();
  const [result, setResult] = usePasteResult();
  // In a pop-up the outcome belongs to that pop-up: closing it must not leave it waiting for next time.
  useEffect(() => {
    if (!onDone) return undefined;
    return () => {
      setResult(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const addFn = useServerFn(bulkAddDancers);
  const capsFn = useServerFn(getImportCapabilities);
  const readPhotoFn = useServerFn(readDancersFromPhoto);
  const caps = useQuery({ queryKey: ["import-capabilities"], queryFn: () => capsFn() });
  const fileInput = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const listPlansFn = useServerFn(listFeePlans);
  const loadProfile = useServerFn(getProfile);
  const saveProfileFn = useServerFn(saveProfile);
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["account-profile"], queryFn: () => loadProfile() });
  const [studioName, setStudioName] = useState("");
  const askStudioName = profile.data !== undefined && (profile.data?.studio_name ?? "") === "";
  const plans = useQuery({
    queryKey: ["fee-plans", false],
    queryFn: () => listPlansFn({ data: {} }),
  });

  const today = todayInIndia();
  const [gridRows, setGridRows] = useState<GridRow[]>(() => startRows());
  const [fee, setFee] = useState<string | null>(null);
  const [bill, setBill] = useState(true);
  const [dueChoice, setDueChoice] = useState("");
  const [error, setError] = useState("");

  const feeText =
    fee ??
    suggestFeeRupees(
      plans.data?.flatMap((plan) =>
        Array.from({ length: plan.students_assigned }, () => Number(plan.amount_paise)),
      ) ?? [],
    );
  const defaultFeePaise = parseRupees(feeText);
  const rows = useMemo(() => checkGrid(gridRows), [gridRows]);
  const good = addableFromGrid(rows);
  const problems = useMemo(
    () =>
      new Map(
        rows.flatMap((row) => (row.problem ? [[row.index, row.problem] as [number, string]] : [])),
      ),
    [rows],
  );
  const fixes = rows.length - good.length;
  const needsFee = good.some((row) => row.feePaise === null) && defaultFeePaise === null;
  const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(dueChoice)
    ? dueChoice
    : defaultDueDate(today, profile.data?.fee_due_day ?? 5);

  const mutation = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          dancers: good.map((row) => ({
            name: row.name,
            phone: row.phone,
            feePaise: row.feePaise,
            email: row.email,
            joinedOn: row.joinedOn,
            emergencyName: row.emergencyName,
            emergencyPhone: row.emergencyPhone,
            note: row.note,
          })),
          defaultFeePaise,
          billThisMonth: bill,
          dueOn,
        },
      }),
    onSuccess: (done) => {
      // The studio name goes into every reminder and private link, so it is asked for once, here.
      const typed = studioName.trim();
      if (askStudioName && typed.length >= 2) {
        const current = profile.data;
        void saveProfileFn({
          data: {
            name: current?.name && current.name.length >= 2 ? current.name : typed,
            studioName: typed,
            phone: current?.phone ?? "",
            city: current?.city ?? "",
          },
        })
          .then(() => {
            void queryClient.invalidateQueries({ queryKey: ["console-context"] });
            void queryClient.invalidateQueries({ queryKey: ["account-profile"] });
          })
          .catch(() => undefined);
      }
      refresh();
      refreshMoney();
      setError("");
      setResult({ ...done, billed: bill, dueOn });
    },
    onError: (e) => setError(messageOf(e)),
  });

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setReading(true);
    try {
      const image = await photoToBase64(file);
      const read = await readPhotoFn({ data: { image, mediaType: "image/jpeg" } });
      if (read.rows.length === 0)
        setError("No dancers could be read from that page. Try a clearer photo.");
      else
        setGridRows((current) => {
          const kept = current.filter((row) => row.name.trim() !== "" || row.phone.trim() !== "");
          const text = read.rows
            .map((row) =>
              [
                row.name,
                row.phone ?? "",
                row.feePaise === null ? "" : String(row.feePaise / 100),
              ].join("\t"),
            )
            .join("\n");
          return pasteIntoGrid(kept, kept.length, "name", ["name", "phone", "fee"], text).rows;
        });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setReading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (good.length === 0) return setError("Paste at least one dancer first.");
    if (needsFee) return setError("Enter a monthly fee, or put a fee after each name.");
    mutation.mutate();
  }

  if (result) {
    const none = result.added === 0;
    return (
      <div className="paste-done" role="status">
        <p className="paste-done-big">
          {none
            ? "Nobody new to add."
            : `${result.added} dancer${result.added === 1 ? "" : "s"} added.`}
        </p>
        {result.skipped > 0 && (
          <p className="console-hint">
            {result.skipped === 1
              ? "1 was already on your list, so it was left as it is."
              : `${result.skipped} were already on your list, so they were left as they are.`}
          </p>
        )}
        {result.billed && (
          <p>
            {result.charged > 0
              ? `${result.charged} charge${result.charged === 1 ? "" : "s"} created for this month, due ${formatDay(result.dueOn)}.`
              : "This month's charges were already there."}
          </p>
        )}
        <div className="console-actions">
          <Button asChild variant="retro">
            <Link
              to="/app"
              onClick={() => {
                setResult(null);
                onDone?.();
              }}
            >
              {result.billed ? "See who hasn't paid" : "Go to Overview"}
            </Link>
          </Button>
          <Button
            variant="retroPaper"
            type="button"
            onClick={() => {
              setResult(null);
              setGridRows(startRows());
            }}
          >
            Add more
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="console-form paste-form" onSubmit={submit} noValidate>
      <div className="console-field">
        <Button variant="retro" type="button" onClick={() => setImportOpen(true)}>
          Import your Excel or CSV sheet
        </Button>
        <span className="console-hint">
          Already keep dancers in a sheet? Upload it and we match the columns for you. Or type them
          below.
        </span>
      </div>
      <ConsoleDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import from Excel or CSV"
      >
        {importOpen && <ImportSheet onDone={() => setImportOpen(false)} />}
      </ConsoleDialog>

      <div className="console-field">
        <span className="form-label">Type or paste your dancers</span>
        <DancerGrid rows={gridRows} onChange={setGridRows} problems={problems} />
        <span className="console-hint">
          One dancer per row. Copy from a notebook, Excel or WhatsApp contacts and paste into the
          first cell. Use Columns to add email, joining date, emergency contact or a note.
        </span>
      </div>

      {caps.data?.photo && (
        <div className="console-field">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={onPhoto}
          />
          <Button
            variant="retroPaper"
            type="button"
            disabled={reading}
            onClick={() => fileInput.current?.click()}
          >
            {reading ? "Reading the page…" : "Read from a photo of your register"}
          </Button>
          <span className="console-hint">
            The photo is only used to read the page and is not kept. You check every row before
            anything is saved.
          </span>
        </div>
      )}

      {askStudioName && (
        <label className="form-label console-field">
          Your studio&apos;s name
          <input
            className="field"
            value={studioName}
            onChange={(event) => setStudioName(event.target.value)}
            maxLength={120}
            autoComplete="organization"
          />
          <span className="console-hint">
            Shown in your reminders and on your dancers&apos; links.
          </span>
        </label>
      )}

      <label className="form-label console-field">
        Monthly fee for everyone (₹)
        <input
          className="field paste-fee"
          inputMode="decimal"
          value={feeText}
          onChange={(event) => setFee(event.target.value)}
          aria-invalid={needsFee}
        />
      </label>

      {rows.length > 0 && (
        <div className="paste-preview" aria-live="polite">
          <p>
            <strong>
              {good.length} dancer{good.length === 1 ? "" : "s"} ready
            </strong>
            {fixes > 0 && <span className="paste-fix"> · {fixes} to fix</span>}
          </p>
          <ul className="paste-rows">
            {rows.slice(0, 60).map((row) => (
              <li key={row.index} data-bad={row.problem !== null}>
                <span>{row.name || "(no name)"}</span>
                <span className="console-hint">
                  {row.problem ??
                    `${row.phone ?? "no phone"} · ${
                      (row.feePaise ?? defaultFeePaise) === null
                        ? "no fee"
                        : formatRupees((row.feePaise ?? defaultFeePaise) as number)
                    }`}
                </span>
              </li>
            ))}
          </ul>
          {rows.length > 60 && <p className="console-hint">…and {rows.length - 60} more.</p>}
        </div>
      )}

      <label className="console-check">
        <input type="checkbox" checked={bill} onChange={(event) => setBill(event.target.checked)} />
        Also create this month&apos;s fee for each
      </label>
      {bill && (
        <label className="form-label">
          Due date
          <input
            className="field"
            type="date"
            value={dueOn}
            onChange={(event) => setDueChoice(event.target.value)}
          />
        </label>
      )}
      <FormAlert message={error} />
      <div className="console-actions">
        <Button variant="retro" type="submit" disabled={mutation.isPending || good.length === 0}>
          {mutation.isPending
            ? "Adding…"
            : good.length === 0
              ? "Add dancers"
              : `Add ${good.length} dancer${good.length === 1 ? "" : "s"}`}
        </Button>
        {onDone && (
          <Button variant="retroPaper" type="button" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

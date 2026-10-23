import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useRefreshStudents } from "@/components/console/console-data";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { bulkAddDancers } from "@/lib/bulk-dancers.functions";
import { addableDancers, parseDancerList, suggestFeeRupees } from "@/lib/bulk-dancers";
import { listFeePlans } from "@/lib/fees.functions";
import { formatDay } from "@/lib/format";
import { formatRupees, parseRupees } from "@/lib/money";
import { firstOfMonth, todayInIndia } from "@/lib/validators";

const EXAMPLE = "Asha Rao, 98765 43210\nBela Shah, 91234 56789, 1800\nChirag Nair, 99887 76655";

/** The 5th of this month, or tomorrow if the 5th has gone, so the first reminders are not already "overdue". */
function defaultDueDate(today: string): string {
  const fifth = `${firstOfMonth(today).slice(0, 8)}05`;
  if (fifth >= today) return fifth;
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

/**
 * Paste a list, check it, add everyone. The fastest way to fill a new studio: one fee for everyone (or a fee after
 * a name), this month's charges created in the same step, and no fee plans or batches to set up first.
 */
export function PasteDancers({ onDone }: { onDone?: () => void }) {
  const refresh = useRefreshStudents();
  const addFn = useServerFn(bulkAddDancers);
  const listPlansFn = useServerFn(listFeePlans);
  const plans = useQuery({ queryKey: ["fee-plans", false], queryFn: () => listPlansFn({ data: {} }) });

  const today = todayInIndia();
  const [text, setText] = useState("");
  const [fee, setFee] = useState<string | null>(null);
  const [bill, setBill] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    added: number;
    skipped: number;
    charged: number;
  } | null>(null);

  const feeText =
    fee ?? suggestFeeRupees(plans.data?.map((plan) => Number(plan.amount_paise)) ?? []);
  const defaultFeePaise = parseRupees(feeText);
  const rows = useMemo(() => parseDancerList(text), [text]);
  const good = addableDancers(rows);
  const fixes = rows.length - good.length;
  const needsFee = good.some((row) => row.feePaise === null) && defaultFeePaise === null;
  const dueOn = defaultDueDate(today);

  const mutation = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          dancers: good.map((row) => ({
            name: row.name,
            phone: row.phone,
            feePaise: row.feePaise,
          })),
          defaultFeePaise,
          billThisMonth: bill,
          dueOn,
        },
      }),
    onSuccess: (done) => {
      refresh();
      setError("");
      setResult({ added: done.added, skipped: done.skipped, charged: done.charged });
    },
    onError: (e) => setError(messageOf(e)),
  });

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
          {none ? "Nobody new to add." : `${result.added} dancer${result.added === 1 ? "" : "s"} added.`}
        </p>
        {result.skipped > 0 && (
          <p className="console-hint">
            {result.skipped} {result.skipped === 1 ? "was" : "were"} already on your list, so
            {result.skipped === 1 ? " it was" : " they were"} left as they are.
          </p>
        )}
        {bill && (
          <p>
            {result.charged > 0
              ? `${result.charged} charge${result.charged === 1 ? "" : "s"} created for this month, due ${formatDay(dueOn)}.`
              : "This month's charges were already there."}
          </p>
        )}
        <div className="console-actions">
          <Button asChild variant="retro">
            <Link to="/app" onClick={onDone}>
              {bill ? "See who hasn't paid" : "Go to Overview"}
            </Link>
          </Button>
          <Button
            variant="retroPaper"
            type="button"
            onClick={() => {
              setResult(null);
              setText("");
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
      <label className="form-label console-field">
        Paste your dancers, one per line
        <textarea
          className="field paste-box"
          rows={7}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={EXAMPLE}
          autoFocus
          spellCheck={false}
          aria-describedby="paste-help"
        />
        <span id="paste-help" className="console-hint">
          Name, then phone number. Copy from a notebook, Excel or WhatsApp contacts. You can type a
          fee after a name if it differs.
        </span>
      </label>

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
              <li key={row.line} data-bad={row.problem !== null}>
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
        Also create this month&apos;s fee for each, due {formatDay(dueOn)}
      </label>
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

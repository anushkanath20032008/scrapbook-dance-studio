import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { useRefreshMoney, useRefreshStudents } from "@/components/console/console-data";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { bulkAddDancers } from "@/lib/bulk-dancers.functions";
import { formatRupees, parseRupees } from "@/lib/money";
import {
  buildImport,
  guessColumns,
  needsAnswer,
  parseCsv,
  recommendations,
  TARGETS,
  toSheet,
  type ColumnGuess,
  type Sheet,
  type Target,
} from "@/lib/import-mapping";
import { todayInIndia } from "@/lib/validators";

const MAX_FILE = 5 * 1024 * 1024;

async function readFile(file: File): Promise<unknown[][]> {
  if (file.size > MAX_FILE) throw new Error("That file is too big. Keep it under 5 MB.");
  if (/\.(csv|tsv|txt)$/i.test(file.name)) return parseCsv(await file.text());
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }
  throw new Error(
    "Use an Excel (.xlsx) or CSV file. For an old .xls file, choose Save As → Excel Workbook or CSV first.",
  );
}

/**
 * Upload the sheet the studio already keeps. Columns are matched to dancer fields by heading and by what is in
 * them; only the ones it is unsure of are asked about. The file is read in the browser and never uploaded: only
 * the checked dancers are sent.
 */
export function ImportSheet({ onDone }: { onDone: () => void }) {
  const refresh = useRefreshStudents();
  const refreshMoney = useRefreshMoney();
  const addFn = useServerFn(bulkAddDancers);
  const input = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<ColumnGuess[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [fee, setFee] = useState("");
  const [bill, setBill] = useState(true);
  const [done, setDone] = useState<{
    added: number;
    skipped: number;
    batchesCreated: number;
  } | null>(null);

  const plan = useMemo(() => (sheet ? buildImport(sheet, mapping) : null), [sheet, mapping]);
  const good = plan?.dancers.filter((d) => d.problem === null) ?? [];
  const asked = mapping.filter(needsAnswer);
  const sure = mapping.filter((m) => !needsAnswer(m) && m.samples.length > 0);
  const defaultFee = parseRupees(fee);
  const needsFee = good.some((d) => d.feePaise === null) && defaultFee === null && good.length > 0;
  const tips = plan ? recommendations(mapping, plan) : [];

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const next = toSheet(await readFile(file));
      if (next.rows.length === 0) throw new Error("No dancers were found in that file.");
      setSheet(next);
      setMapping(guessColumns(next));
      setFileName(file.name);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  const choose = (index: number, target: Target) =>
    setMapping((current) =>
      current.map((m) =>
        m.index === index
          ? { ...m, target, confidence: "sure", reason: "You chose this" }
          : target !== "ignore" && target !== "note" && target !== "batch" && m.target === target
            ? {
                ...m,
                target: "ignore",
                confidence: "unknown",
                reason: "Another column is used for this now",
              }
            : m,
      ),
    );

  const mutation = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          dancers: good.map((d) => ({
            name: d.name,
            phone: d.phone,
            feePaise: d.feePaise,
            email: d.email,
            joinedOn: d.joinedOn,
            emergencyName: d.emergencyName,
            emergencyPhone: d.emergencyPhone,
            note: d.note,
            batches: d.batches,
            parentName: d.parentName,
          })),
          defaultFeePaise: defaultFee,
          billThisMonth: bill,
        },
      }),
    onSuccess: (result) => {
      refresh();
      refreshMoney();
      setDone(result);
    },
    onError: (e) => setError(messageOf(e)),
  });

  if (done) {
    return (
      <div className="paste-done" role="status">
        <p className="paste-done-big">
          {done.added === 0
            ? "Nobody new to add."
            : `${done.added} dancer${done.added === 1 ? "" : "s"} added.`}
        </p>
        {done.skipped > 0 && (
          <p className="console-hint">{done.skipped} already on your list were left as they are.</p>
        )}
        {done.batchesCreated > 0 && (
          <p className="console-hint">
            {done.batchesCreated} new batch{done.batchesCreated === 1 ? "" : "es"} created from your
            classes. Set their days and times in Batches.
          </p>
        )}
        <div className="console-actions">
          <Button variant="retro" type="button" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (!sheet || !plan) {
    return (
      <div className="console-form paste-form">
        <input ref={input} type="file" hidden accept=".xlsx,.csv,.tsv,.txt" onChange={onFile} />
        <p>
          Upload the Excel or CSV sheet you already keep. We take only what is in it (name, phone,
          fee, classes and so on) and ask you about anything we are unsure of.
        </p>
        <div className="console-actions">
          <Button variant="retro" type="button" onClick={() => input.current?.click()}>
            Choose a file
          </Button>
        </div>
        <span className="console-hint">
          .xlsx or .csv. The file is read on your device; nothing is saved until you press Add.
        </span>
        {error && <FormAlert message={error} />}
      </div>
    );
  }

  return (
    <div className="console-form paste-form import-sheet">
      <p className="console-hint">
        {fileName} · {sheet.rows.length} rows
      </p>

      <div className="import-block">
        <h3>What we found</h3>
        <ul className="import-cols">
          {sure.map((m) => (
            <li key={m.index}>
              <span className="import-head">{m.header}</span>
              <span className="import-arrow" aria-hidden="true">
                →
              </span>
              <select
                className="field"
                aria-label={`What is ${m.header}?`}
                value={m.target}
                onChange={(e) => choose(m.index, e.target.value as Target)}
              >
                {TARGETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="console-hint">{m.samples.join(", ")}</span>
            </li>
          ))}
        </ul>
      </div>

      {asked.length > 0 && (
        <div className="import-block import-ask">
          <h3>Not sure about {asked.length === 1 ? "this one" : "these"}</h3>
          <p className="console-hint">
            Pick where each goes. “Keep in notes” saves it on the dancer with its heading, so
            nothing is lost.
          </p>
          <ul className="import-cols">
            {asked.map((m) => (
              <li key={m.index}>
                <span className="import-head">{m.header}</span>
                <span className="import-arrow" aria-hidden="true">
                  →
                </span>
                <select
                  className="field"
                  aria-label={`What is ${m.header}?`}
                  value={m.target}
                  onChange={(e) => choose(m.index, e.target.value as Target)}
                >
                  {TARGETS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id === "ignore" ? "Skip this column" : t.label}
                    </option>
                  ))}
                </select>
                <span className="console-hint">{m.samples.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tips.length > 0 && (
        <div className="import-block import-tips">
          <h3>Worth adding</h3>
          <ul>
            {tips.map((t) => (
              <li key={t.id}>{t.text}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="paste-preview" aria-live="polite">
        <p>
          <strong>
            {good.length} dancer{good.length === 1 ? "" : "s"} ready
          </strong>
          {plan.problems.length > 0 && (
            <span className="paste-fix"> · {plan.problems.length} to fix in your sheet</span>
          )}
          {plan.batchNames.length > 0 && (
            <span className="console-hint"> · classes: {plan.batchNames.join(", ")}</span>
          )}
        </p>
        {plan.tooMany && (
          <p className="paste-fix">
            Only the first 200 rows are read at a time. Import the rest in a second file.
          </p>
        )}
        <ul className="paste-rows">
          {plan.problems.slice(0, 20).map((p) => (
            <li key={p.sheetRow} data-bad="true">
              <span>
                Row {p.sheetRow}: {p.name || "(no name)"}
              </span>
              <span className="console-hint">{p.problem}</span>
            </li>
          ))}
          {good.slice(0, 8).map((d) => (
            <li key={d.index}>
              <span>{d.name}</span>
              <span className="console-hint">
                {[d.phone, d.feePaise ? formatRupees(d.feePaise) : null, d.batches.join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
        {good.length > 8 && <p className="console-hint">…and {good.length - 8} more</p>}
      </div>

      {good.some((d) => d.feePaise === null) && (
        <label className="form-label console-field">
          Monthly fee for dancers with none (₹)
          <input
            className="field paste-fee"
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            aria-invalid={needsFee}
          />
        </label>
      )}
      <label className="console-check">
        <input type="checkbox" checked={bill} onChange={(e) => setBill(e.target.checked)} />
        Create this month&apos;s fees now, so the unpaid list is ready ({todayInIndia().slice(0, 7)}
        )
      </label>

      {error && <FormAlert message={error} />}
      <div className="console-actions">
        <Button
          variant="retro"
          type="button"
          disabled={mutation.isPending || good.length === 0}
          onClick={() => {
            setError("");
            if (needsFee)
              return setError(
                "Enter a fee for the dancers who have none, or leave their rows out of the sheet.",
              );
            mutation.mutate();
          }}
        >
          {mutation.isPending
            ? "Adding…"
            : `Add ${good.length} dancer${good.length === 1 ? "" : "s"}`}
        </Button>
        <Button
          variant="retroPaper"
          type="button"
          onClick={() => {
            setSheet(null);
            setError("");
          }}
        >
          Choose another file
        </Button>
      </div>
    </div>
  );
}

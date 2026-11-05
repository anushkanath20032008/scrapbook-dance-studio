import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { useRefreshStudents } from "@/components/console/console-data";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { PasteDancers } from "@/components/console/paste-dancers";
import { ImportSheet } from "@/components/console/import-sheet";
import { StudentForm } from "@/components/console/student-form";
import { StudentPanel } from "@/components/console/student-panel";
import { listBatches } from "@/lib/batches.functions";
import { getConsoleContext } from "@/lib/console.functions";
import { listGuardians, setStudentArchived } from "@/lib/directory.functions";
import { listFeePlans } from "@/lib/fees.functions";
import { formatRupees } from "@/lib/money";
import { listStudentOverview } from "@/lib/setup.functions";
import { toneOf } from "@/lib/tone";

export const Route = createFileRoute("/app/students")({
  head: () => ({ meta: [{ title: "Dancers | ChoreoStudio" }] }),
  component: Dancers,
});

function Dancers() {
  const refresh = useRefreshStudents();
  const listStudents = useServerFn(listStudentOverview);
  const listGuardiansFn = useServerFn(listGuardians);
  const listBatchesFn = useServerFn(listBatches);
  const listPlansFn = useServerFn(listFeePlans);
  const archiveFn = useServerFn(setStudentArchived);

  const loadContext = useServerFn(getConsoleContext);
  const capacity = useQuery({ queryKey: ["console-context"], queryFn: () => loadContext() });
  const limit = capacity.data?.studentLimit ?? null;
  const count = capacity.data?.studentCount ?? 0;
  const atLimit = limit !== null && count >= limit;

  const [showArchived, setShowArchived] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const students = useQuery({
    queryKey: ["students-overview", showArchived],
    queryFn: () => listStudents({ data: { includeArchived: showArchived } }),
  });
  const guardians = useQuery({
    queryKey: ["guardians"],
    queryFn: () => listGuardiansFn({ data: {} }),
  });
  const batches = useQuery({
    queryKey: ["batches", false],
    queryFn: () => listBatchesFn({ data: {} }),
  });
  const plans = useQuery({
    queryKey: ["fee-plans", false],
    queryFn: () => listPlansFn({ data: {} }),
  });

  const archive = useMutation({
    mutationFn: (input: { id: string; archived: boolean; name: string }) =>
      archiveFn({ data: { id: input.id, archived: input.archived } }),
    onSuccess: (_row, input) => {
      setError("");
      refresh();
      toast(input.archived ? `${input.name} archived.` : `${input.name} restored.`, {
        ...(input.archived
          ? {
              action: {
                label: "Undo",
                onClick: () => archive.mutate({ id: input.id, archived: false, name: input.name }),
              },
            }
          : {}),
      });
    },
    onError: (e) => setError(messageOf(e)),
  });

  const needle = search.trim().toLowerCase();
  const visible = (students.data ?? []).filter(
    (student) =>
      needle === "" ||
      student.name.toLowerCase().includes(needle) ||
      (student.guardian?.phone ?? "").replace(/\s/g, "").includes(needle.replace(/\s/g, "")),
  );

  const ready = guardians.data && batches.data && plans.data;
  const openStudent = openId
    ? (students.data ?? []).find((student) => student.id === openId)
    : undefined;
  // Cards sit in one band per batch (the first batch for a dancer in several), each band in its own colour.
  const groups = (() => {
    const bands = new Map<string, typeof visible>();
    for (const student of visible) {
      const name = student.batches[0]?.name ?? "No batch";
      bands.set(name, [...(bands.get(name) ?? []), student]);
    }
    return [...bands.entries()]
      .sort(([a], [b]) => (a === "No batch" ? 1 : b === "No batch" ? -1 : a.localeCompare(b)))
      .map(([name, list]) => ({
        name,
        students: list,
        tone: name === "No batch" ? "none" : String(toneOf(name)),
      }));
  })();

  return (
    <section>
      <h1 className="display console-title">Dancers</h1>
      <div className="console-toolbar">
        <Button
          data-tour="add-dancer"
          variant="retro"
          type="button"
          disabled={!ready || atLimit}
          onClick={() => setAddOpen(true)}
        >
          + Add dancer
        </Button>
        {(students.data?.length ?? 0) > 6 && (
          <input
            className="field console-search"
            type="search"
            aria-label="Search dancers"
            placeholder="Search by name or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        )}
        <Button
          variant="retroPaper"
          type="button"
          disabled={atLimit}
          onClick={() => setPasteOpen(true)}
        >
          Paste a list
        </Button>
        <Button
          variant="retroPaper"
          type="button"
          disabled={atLimit}
          onClick={() => setImportOpen(true)}
        >
          Import Excel / CSV
        </Button>
        <label className="console-check">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
      </div>
      {limit !== null && (
        <p className="console-hint" role="status">
          {count} of {limit} dancers on your plan.
          {atLimit && (
            <>
              {" "}
              You have reached the limit. <Link to="/account">Upgrade to Studio+ to add more</Link>.
            </>
          )}
        </p>
      )}
      <FormAlert message={error} />
      {students.isError && <p role="alert">Could not load your dancers. Please refresh.</p>}
      {students.isPending && <p className="console-empty">Loading your dancers…</p>}
      {students.data?.length === 0 && !showArchived && (
        <div className="console-empty-card">
          <p className="console-empty">No dancers yet.</p>
          <p className="console-hint">
            Add each dancer with a phone number so you can send fee reminders on WhatsApp. You can
            add their batch and monthly fee in the same step.
          </p>
          <Button variant="retro" type="button" disabled={!ready} onClick={() => setAddOpen(true)}>
            + Add your first dancer
          </Button>
        </div>
      )}
      {students.data && students.data.length > 0 && visible.length === 0 && (
        <p className="console-empty">No dancer matches &quot;{search.trim()}&quot;.</p>
      )}
      <div className="card-groups">
        {groups.map((group) => (
          <section key={group.name} className="card-group" data-c={group.tone}>
            <h3 className="card-group-title">
              {group.name} <span className="seg-count">{group.students.length}</span>
            </h3>
            <div className="dancer-cards">
              {group.students.map((student) => (
                <article
                  key={student.id}
                  className="dancer-card"
                  data-c={group.tone}
                  data-archived={student.archived_at !== null}
                >
                  {student.archived_at ? (
                    <strong className="dancer-card-name">{student.name}</strong>
                  ) : (
                    <button
                      type="button"
                      className="dancer-card-name"
                      aria-label={`Edit ${student.name}`}
                      onClick={() => setOpenId(student.id)}
                    >
                      {student.name}
                    </button>
                  )}
                  <span className="dancer-card-fee">
                    {student.plan
                      ? `${formatRupees(student.plan.amount_paise)} a month`
                      : "No fee yet"}
                    {student.guardian?.phone ? "" : " · No phone yet"}
                    {student.archived_at ? " · archived" : ""}
                  </span>
                  <span className="dancer-card-foot">
                    {student.batches.length > 1 && (
                      <span className="console-hint">
                        {student.batches.map((b) => b.name).join(", ")}
                      </span>
                    )}
                    <span className="dancer-card-actions">
                      {!student.archived_at && (
                        <Link
                          className="board-ib board-ib-text"
                          to="/app/billing"
                          search={{ student: student.id }}
                        >
                          Billing
                        </Link>
                      )}
                      {!student.archived_at && (
                        <button
                          type="button"
                          className="board-ib board-ib-text"
                          onClick={() => setOpenId(student.id)}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="board-ib board-ib-text"
                        disabled={archive.isPending}
                        onClick={() => {
                          if (openId === student.id) setOpenId(null);
                          archive.mutate({
                            id: student.id,
                            archived: !student.archived_at,
                            name: student.name,
                          });
                        }}
                      >
                        {student.archived_at ? "Restore" : "Archive"}
                      </button>
                    </span>
                  </span>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <ConsoleDialog
        open={openStudent !== undefined && Boolean(ready)}
        onOpenChange={(value) => !value && setOpenId(null)}
        title={openStudent ? openStudent.name : "Dancer"}
      >
        {openStudent && ready && (
          <StudentPanel
            student={openStudent}
            guardians={guardians.data ?? []}
            batches={batches.data ?? []}
            plans={plans.data ?? []}
            onClose={() => setOpenId(null)}
          />
        )}
      </ConsoleDialog>

      <ConsoleDialog open={pasteOpen} onOpenChange={setPasteOpen} title="Paste a list of dancers">
        {pasteOpen && <PasteDancers onDone={() => setPasteOpen(false)} />}
      </ConsoleDialog>

      <ConsoleDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import from Excel or CSV"
      >
        {importOpen && <ImportSheet onDone={() => setImportOpen(false)} />}
      </ConsoleDialog>

      <ConsoleDialog open={addOpen} onOpenChange={setAddOpen} title="New dancer">
        {ready && (
          <StudentForm
            guardians={guardians.data ?? []}
            batches={batches.data ?? []}
            plans={plans.data ?? []}
            onDone={() => setAddOpen(false)}
          />
        )}
      </ConsoleDialog>
    </section>
  );
}

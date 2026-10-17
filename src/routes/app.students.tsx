import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { useRefreshStudents } from "@/components/console/console-data";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { AccessBadge, useMemberAccess } from "@/components/console/member-access-section";
import { StudentForm } from "@/components/console/student-form";
import { StudentPanel } from "@/components/console/student-panel";
import { listBatches } from "@/lib/batches.functions";
import { listGuardians, setStudentArchived } from "@/lib/directory.functions";
import { listFeePlans } from "@/lib/fees.functions";
import { formatRupees } from "@/lib/money";
import { listStudentOverview } from "@/lib/setup.functions";

export const Route = createFileRoute("/app/students")({
  head: () => ({ meta: [{ title: "Dancers | Choreo Studio" }] }),
  component: Dancers,
});

function Dancers() {
  const refresh = useRefreshStudents();
  const listStudents = useServerFn(listStudentOverview);
  const listGuardiansFn = useServerFn(listGuardians);
  const listBatchesFn = useServerFn(listBatches);
  const listPlansFn = useServerFn(listFeePlans);
  const archiveFn = useServerFn(setStudentArchived);

  const [showArchived, setShowArchived] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const accessOf = useMemberAccess();

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
    mutationFn: (input: { id: string; archived: boolean }) => archiveFn({ data: input }),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: (e) => setError(messageOf(e)),
  });

  const ready = guardians.data && batches.data && plans.data;

  return (
    <section>
      <h1 className="display console-title">Dancers</h1>
      <div className="console-toolbar">
        <Button variant="retro" type="button" disabled={!ready} onClick={() => setAddOpen(true)}>
          + Add dancer
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
      <FormAlert message={error} />
      {students.isError && <p role="alert">Could not load your dancers. Please refresh.</p>}
      {students.data?.length === 0 && (
        <p className="console-empty">No dancers yet. Add your first.</p>
      )}
      <ul className="console-list">
        {students.data?.map((student) => (
          <li
            key={student.id}
            className="console-row-wrap"
            data-archived={student.archived_at !== null}
          >
            <div className="console-row">
              <div>
                <strong>{student.name}</strong> <AccessBadge state={accessOf(student.guardian?.id)} />
                <span className="console-hint">
                  {student.guardian?.phone ?? "No phone"}
                  {student.archived_at ? " · archived" : ""}
                </span>
                <span className="console-hint">
                  {student.batches.length > 0
                    ? student.batches.map((batch) => batch.name).join(", ")
                    : "No batch"}
                  {" · "}
                  {student.plan
                    ? `${formatRupees(student.plan.amount_paise)} a month`
                    : "No fee yet"}
                </span>
              </div>
              <div className="console-row-actions">
                {!student.archived_at && (
                  <Button
                    variant="retroPaper"
                    type="button"
                    aria-expanded={openId === student.id}
                    onClick={() => setOpenId(openId === student.id ? null : student.id)}
                  >
                    {openId === student.id ? "Close" : "Manage"}
                  </Button>
                )}
                <Button
                  variant="retroPaper"
                  type="button"
                  disabled={archive.isPending}
                  onClick={() => {
                    if (openId === student.id) setOpenId(null);
                    archive.mutate({ id: student.id, archived: !student.archived_at });
                  }}
                >
                  {student.archived_at ? "Restore" : "Archive"}
                </Button>
              </div>
            </div>
            {openId === student.id && ready && (
              <StudentPanel
                student={student}
                guardians={guardians.data ?? []}
                batches={batches.data ?? []}
                plans={plans.data ?? []}
                onClose={() => setOpenId(null)}
              />
            )}
          </li>
        ))}
      </ul>

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

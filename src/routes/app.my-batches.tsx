import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TeacherAddDancer } from "@/components/console/teacher-add-dancer";
import { BatchRequestDialog } from "@/components/console/batch-request-dialog";
import { describeRequest } from "@/components/console/batch-requests-panel";
import { weekdayNames } from "@/components/console/form-utils";
import { getInstructorBatches, getInstructorRoster, getMyBatchRequests } from "@/lib/instructors.functions";

// The instructor's batches: when each meets and which dancers are on it (names only).
export const Route = createFileRoute("/app/my-batches")({
  head: () => ({ meta: [{ title: "Batches | ChoreoStudio" }] }),
  validateSearch: (search: Record<string, unknown>): { batch?: string } =>
    typeof search["batch"] === "string" && search["batch"] !== "" ? { batch: search["batch"] } : {},
  component: InstructorBatches,
});

const clock = (value: string | null) => (value ? value.slice(0, 5) : "");

function InstructorBatches() {
  const { batch: onlyBatch } = Route.useSearch();
  const batchesFn = useServerFn(getInstructorBatches);
  const batches = useQuery({ queryKey: ["instructor-batches"], queryFn: () => batchesFn() });
  const requestsFn = useServerFn(getMyBatchRequests);
  const requests = useQuery({ queryKey: ["my-batch-requests"], queryFn: () => requestsFn() });
  const [suggesting, setSuggesting] = useState(false);
  const [adding, setAdding] = useState<{ id: string; name: string } | null>(null);

  return (
    <section>
      <h1 className="display console-title">Batches</h1>
      <div className="console-toolbar">
        <Button variant="retro" type="button" onClick={() => setSuggesting(true)}>
          + Suggest a batch
        </Button>
      </div>
      {batches.isError && <p role="alert">Could not load the batches. Please refresh.</p>}
      {batches.data?.length === 0 && (
        <p className="console-empty">The studio has no batches yet. Suggest one above, or ask the owner to add it.</p>
      )}
      <ul className="console-list">
        {batches.data?.filter((batch) => !onlyBatch || batch.id === onlyBatch).map((batch) => (
          <BatchRow onAdd={setAdding} key={batch.id} batch={batch} />
        ))}
      </ul>
      {requests.data && requests.data.length > 0 && (
        <>
          <h2 className="console-subtitle">Your suggestions</h2>
          <ul className="console-list">
            {requests.data.map((request) => (
              <li key={request.id} className="console-row">
                <div>
                  <strong>{request.name}</strong>
                  <span className="console-hint">{describeRequest(request)}</span>
                </div>
                <span
                  className="status-pill"
                  data-tone={request.status === "approved" ? "good" : request.status === "declined" ? "warn" : "idle"}
                >
                  {request.status === "pending" ? "Waiting for the owner" : request.status === "approved" ? "Approved" : "Declined"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <BatchRequestDialog open={suggesting} onClose={() => setSuggesting(false)} />
      <TeacherAddDancer batch={adding} onClose={() => setAdding(null)} />
    </section>
  );
}

function BatchRow({
  batch,
  onAdd,
}: {
  onAdd: (batch: { id: string; name: string }) => void;
  batch: {
    id: string;
    name: string;
    weekdays: number[];
    starts_at: string | null;
    ends_at: string | null;
    room: string | null;
  };
}) {
  const rosterFn = useServerFn(getInstructorRoster);
  const roster = useQuery({
    queryKey: ["instructor-roster", batch.id],
    queryFn: () => rosterFn({ data: { batchId: batch.id } }),
  });
  const when = [
    batch.weekdays.map((day) => weekdayNames[day]).join(", "),
    batch.starts_at ? `${clock(batch.starts_at)}${batch.ends_at ? `–${clock(batch.ends_at)}` : ""}` : "",
    batch.room ?? "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="console-row">
      <div>
        <strong>{batch.name}</strong>
        {when && <span className="console-hint"> {when}</span>}
        {roster.isError && <p role="alert">Could not load the dancers.</p>}
        {roster.data && roster.data.length === 0 && <p className="console-hint">No dancers yet.</p>}
        {roster.data && roster.data.length > 0 && (
          <p className="console-hint">{roster.data.map((row) => row.student_name).join(", ")}</p>
        )}
      </div>
      <Button variant="retroPaper" type="button" onClick={() => onAdd({ id: batch.id, name: batch.name })}>
        Add dancer
      </Button>
    </li>
  );
}

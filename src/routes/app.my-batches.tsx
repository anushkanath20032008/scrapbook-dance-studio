import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { weekdayNames } from "@/components/console/form-utils";
import { getInstructorBatches, getInstructorRoster } from "@/lib/instructors.functions";

// The instructor's batches: when each meets and which dancers are on it (names only).
export const Route = createFileRoute("/app/my-batches")({
  head: () => ({ meta: [{ title: "Batches | ChoreoStudio" }] }),
  component: InstructorBatches,
});

const clock = (value: string | null) => (value ? value.slice(0, 5) : "");

function InstructorBatches() {
  const batchesFn = useServerFn(getInstructorBatches);
  const batches = useQuery({ queryKey: ["instructor-batches"], queryFn: () => batchesFn() });

  return (
    <section>
      <h1 className="display console-title">Batches</h1>
      {batches.isError && <p role="alert">Could not load the batches. Please refresh.</p>}
      {batches.data?.length === 0 && (
        <p className="console-empty">The studio has no batches yet. Ask the owner to add one.</p>
      )}
      <ul className="console-list">
        {batches.data?.map((batch) => (
          <BatchRow key={batch.id} batch={batch} />
        ))}
      </ul>
    </section>
  );
}

function BatchRow({
  batch,
}: {
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
    </li>
  );
}

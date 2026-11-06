import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { formatDay, maskPhone } from "@/lib/format";
import { getInstructorStudents } from "@/lib/instructors.functions";

// The teacher's view of every dancer in the studio: who they are and which batches they are in. Fees, charges
// and payment status are not part of what the database gives a teacher.
export const Route = createFileRoute("/app/my-dancers")({
  head: () => ({ meta: [{ title: "Dancers | ChoreoStudio" }] }),
  component: InstructorDancers,
});

function InstructorDancers() {
  const load = useServerFn(getInstructorStudents);
  const dancers = useQuery({ queryKey: ["instructor-students"], queryFn: () => load() });
  const [search, setSearch] = useState("");
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (dancers.data ?? []).filter(
      (d) =>
        term === "" ||
        d.name.toLowerCase().includes(term) ||
        (d.phone ?? "").replace(/\D/g, "").includes(term.replace(/\D/g, "") || "\u0000") ||
        d.batches.some((b) => b.toLowerCase().includes(term)),
    );
  }, [dancers.data, search]);

  return (
    <section>
      <h1 className="display console-title">Dancers</h1>
      <p className="console-hint">
        Everyone in the studio. Fees and payments are kept by the studio owner.
      </p>
      <label className="form-label console-field">
        Search by name, phone or batch
        <input
          className="field"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {dancers.isError && <p role="alert">Could not load the dancers. Please refresh.</p>}
      {dancers.data?.length === 0 && <p className="console-empty">No dancers in the studio yet.</p>}
      <ul className="console-list">
        {shown.map((d) => (
          <li key={d.id} className="console-row">
            <div>
              <strong>{d.name}</strong>
              <span className="console-hint">
                {[
                  maskPhone(d.phone),
                  d.email,
                  d.joined_on ? `Joined ${formatDay(d.joined_on)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No contact details"}
              </span>
              <span className="console-hint">
                {d.batches.length > 0 ? d.batches.join(", ") : "Not in a batch yet"}
              </span>
              {(d.emergency_name || d.emergency_phone) && (
                <span className="console-hint">
                  Emergency:{" "}
                  {[d.emergency_name, maskPhone(d.emergency_phone)].filter(Boolean).join(" · ")}
                </span>
              )}
              {d.note && <span className="console-hint">{d.note}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

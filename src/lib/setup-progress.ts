// The setup checklist is derived from what exists, never stored, so it cannot drift from the data.

export type SetupCounts = {
  feePlans: number;
  batches: number;
  students: number;
  studentsWithContact: number;
  studentsOnBatch: number;
  studentsWithPlan: number;
};

export type SetupStep = {
  id: "plans" | "batches" | "students" | "roster" | "assign";
  title: string;
  detail: string;
  done: boolean;
  to: "/app/plans" | "/app/batches" | "/app/students";
};

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

export function buildSetupSteps(counts: SetupCounts): SetupStep[] {
  return [
    {
      id: "plans",
      title: "Add your fee plans",
      detail: counts.feePlans > 0 ? count(counts.feePlans, "fee plan") : "No fee plans yet",
      done: counts.feePlans > 0,
      to: "/app/plans",
    },
    {
      id: "batches",
      title: "Add your batches",
      detail: counts.batches > 0 ? count(counts.batches, "batch") : "No batches yet",
      done: counts.batches > 0,
      to: "/app/batches",
    },
    {
      id: "students",
      title: "Add your dancers with a phone number",
      detail:
        counts.students > 0
          ? `${count(counts.students, "dancer")}, ${counts.studentsWithContact} with a phone`
          : "No dancers yet",
      done: counts.studentsWithContact > 0,
      to: "/app/students",
    },
    {
      id: "roster",
      title: "Put dancers on batches",
      detail:
        counts.studentsOnBatch > 0
          ? `${count(counts.studentsOnBatch, "dancer")} on a batch`
          : "No dancer is on a batch yet",
      done: counts.studentsOnBatch > 0,
      to: "/app/students",
    },
    {
      id: "assign",
      title: "Set a monthly fee for every dancer",
      detail:
        counts.students > 0
          ? `${counts.studentsWithPlan} of ${counts.students} dancers have a fee`
          : "Add dancers first",
      done: counts.students > 0 && counts.studentsWithPlan === counts.students,
      to: "/app/students",
    },
  ];
}

export function setupProgress(steps: SetupStep[]) {
  const done = steps.filter((step) => step.done).length;
  return { done, total: steps.length, complete: done === steps.length };
}

// The setup checklist is derived from what exists, never stored, so it cannot drift from the data.
// Three steps get a studio to its first reminder: dancers, their fees, this month's charges. Batches
// and rosters are real but optional, so they never block the studio and are listed apart.

export type SetupCounts = {
  feePlans: number;
  batches: number;
  students: number;
  studentsWithContact: number;
  studentsOnBatch: number;
  studentsWithPlan: number;
  /** Charges that exist for the current month. */
  chargesThisMonth: number;
};

export type SetupStep = {
  id: "students" | "fees" | "charges" | "batches" | "roster";
  title: string;
  detail: string;
  done: boolean;
  optional: boolean;
  to: "/app" | "/app/batches" | "/app/students";
  /** What the button says while the step is still to do. */
  action: string;
};

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

export function buildSetupSteps(counts: SetupCounts): SetupStep[] {
  const everyoneHasFee = counts.students > 0 && counts.studentsWithPlan === counts.students;
  return [
    {
      id: "students",
      title: "Add your dancers",
      detail:
        counts.students > 0
          ? `${count(counts.students, "dancer")}, ${counts.studentsWithContact} with a phone number`
          : "Paste a list of names and phone numbers, or add one at a time",
      done: counts.studentsWithContact > 0,
      optional: false,
      to: "/app/students",
      action: "Add dancers",
    },
    {
      id: "fees",
      title: "Set each dancer's monthly fee",
      detail:
        counts.students > 0
          ? `${counts.studentsWithPlan} of ${counts.students} dancers have a fee`
          : "Add dancers first",
      done: everyoneHasFee,
      optional: false,
      to: "/app/students",
      action: "Set fees",
    },
    {
      id: "charges",
      title: "Create this month's fees",
      detail:
        counts.chargesThisMonth > 0
          ? `${count(counts.chargesThisMonth, "dancer")} billed this month`
          : "This makes the list of who has not paid",
      done: counts.chargesThisMonth > 0,
      optional: false,
      to: "/app",
      action: "Create fees",
    },
    {
      id: "batches",
      title: "Add your batches",
      detail:
        counts.batches > 0
          ? count(counts.batches, "batch")
          : "Optional. Needed for attendance and for dancers to see class times",
      done: counts.batches > 0,
      optional: true,
      to: "/app/batches",
      action: "Add batches",
    },
    {
      id: "roster",
      title: "Put dancers on batches",
      detail:
        counts.studentsOnBatch > 0
          ? `${count(counts.studentsOnBatch, "dancer")} on a batch`
          : "Optional. Do this after adding batches",
      done: counts.studentsOnBatch > 0,
      optional: true,
      to: "/app/students",
      action: "Open dancers",
    },
  ];
}

/** Progress counts the required steps only: a studio that has done them is ready, whatever is optional. */
export function setupProgress(steps: SetupStep[]) {
  const required = steps.filter((step) => !step.optional);
  const done = required.filter((step) => step.done).length;
  return { done, total: required.length, complete: done === required.length };
}

/** The first required step still to do, which is the one thing the owner should do next. */
export function nextSetupStep(steps: SetupStep[]): SetupStep | null {
  return steps.find((step) => !step.optional && !step.done) ?? null;
}

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
      title: "Add students with a guardian and phone",
      detail:
        counts.students > 0
          ? `${count(counts.students, "student")}, ${counts.studentsWithContact} with a guardian phone`
          : "No students yet",
      done: counts.studentsWithContact > 0,
      to: "/app/students",
    },
    {
      id: "roster",
      title: "Put students on batches",
      detail:
        counts.studentsOnBatch > 0
          ? `${count(counts.studentsOnBatch, "student")} on a batch`
          : "No student is on a batch yet",
      done: counts.studentsOnBatch > 0,
      to: "/app/students",
    },
    {
      id: "assign",
      title: "Give every student a fee plan",
      detail:
        counts.students > 0
          ? `${counts.studentsWithPlan} of ${counts.students} students have a plan`
          : "Add students first",
      done: counts.students > 0 && counts.studentsWithPlan === counts.students,
      to: "/app/students",
    },
  ];
}

export function setupProgress(steps: SetupStep[]) {
  const done = steps.filter((step) => step.done).length;
  return { done, total: steps.length, complete: done === steps.length };
}

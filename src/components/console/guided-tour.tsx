import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type TourRole = "owner" | "teacher";
type Step = { target: string | null; title: string; text: string };

// A short walk through the menu, shown once after the first sign-in and again from "Take the tour".
const steps: Record<TourRole, Step[]> = {
  owner: [
    {
      target: null,
      title: "Welcome to ChoreoStudio",
      text: "This takes about a minute. It shows what each part of the menu is for. You can skip it any time.",
    },
    {
      target: "overview",
      title: "Overview",
      text: "Start here each day. It shows who owes fees this month, how much is unpaid, and what needs doing today.",
    },
    {
      target: "dancers",
      title: "Dancers",
      text: "Add the dancers in your studio from a photo of your register, a pasted list, or one at a time.",
    },
    {
      target: "money",
      title: "Payments",
      text: "Charge monthly fees, send WhatsApp reminders, confirm payments dancers say they made, and close the month.",
    },
    {
      target: "attendance",
      title: "Attendance",
      text: "Mark who came to class. Pick a batch and a date, then tap the dancers who missed.",
    },
    {
      target: "studio",
      title: "Studio",
      text: "Set up batches and fee plans, plan make-up classes, invite dance teachers, and manage your account.",
    },
    {
      target: null,
      title: "You are ready",
      text: "Hover over any menu item or button to see what it does. You can replay this tour from the menu.",
    },
  ],
  teacher: [
    {
      target: null,
      title: "Welcome to your studio",
      text: "This takes under a minute. You see only what you need to teach: batches, dancer names and attendance.",
    },
    {
      target: "attendance",
      title: "Attendance",
      text: "Pick a batch and a date. Everyone starts as present, so tap Absent for the dancers who missed, then save.",
    },
    {
      target: "batches",
      title: "Batches",
      text: "Your classes: when each one meets and which dancers are in it.",
    },
    {
      target: "makeups",
      title: "Make-ups",
      text: "Plan a make-up class for dancers who missed one: choose the batch, the date and who is coming.",
    },
  ],
};

const seenKey = (role: TourRole) => `choreo-tour-${role}`;

export function tourSeen(role: TourRole): boolean {
  try {
    return window.localStorage.getItem(seenKey(role)) === "done";
  } catch {
    return true;
  }
}

function markSeen(role: TourRole) {
  try {
    window.localStorage.setItem(seenKey(role), "done");
  } catch {
    // Without storage the tour may show again next visit; nothing breaks.
  }
}

/** Walks through the menu one item at a time, outlining the item it is talking about. */
export function GuidedTour({ role, onClose }: { role: TourRole; onClose: () => void }) {
  const list = steps[role];
  const [index, setIndex] = useState(0);
  const step = list[index] as Step;
  const last = index === list.length - 1;

  useEffect(() => {
    if (!step.target) return undefined;
    const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    element?.classList.add("tour-highlight");
    element?.scrollIntoView?.({ block: "nearest" });
    return () => element?.classList.remove("tour-highlight");
  }, [step.target]);

  function finish() {
    markSeen(role);
    onClose();
  }

  return (
    <div className="tour-card" role="dialog" aria-label="Guided tour" aria-live="polite">
      <p className="tour-step chrome-font">
        Step {index + 1} of {list.length}
      </p>
      <h2 className="display tour-title">{step.title}</h2>
      <p>{step.text}</p>
      <div className="console-actions">
        <Button variant="retro" type="button" onClick={() => (last ? finish() : setIndex(index + 1))}>
          {last ? "Finish" : "Next"}
        </Button>
        {index > 0 && !last && (
          <Button variant="retroPaper" type="button" onClick={() => setIndex(index - 1)}>
            Back
          </Button>
        )}
        {!last && (
          <Button variant="retroPaper" type="button" title="Close the tour; you can replay it from the menu" onClick={finish}>
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}

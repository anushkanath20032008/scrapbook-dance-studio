import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type TourRole = "owner" | "teacher";
// `to` is the page the step opens; `target` is the element to spotlight (a data-tour value).
type Step = { to?: string; target: string | null; title: string; text: string };

// A walk through the app, shown once after the first sign-in and again from "Take the tour". Each step opens
// the page it is talking about and dims everything except the part it points at.
const steps: Record<TourRole, Step[]> = {
  owner: [
    {
      target: null,
      title: "Welcome to ChoreoStudio",
      text: "This takes about a minute. It walks you through the app, one part at a time. You can skip it any time.",
    },
    {
      to: "/app",
      target: "totals",
      title: "This month at a glance",
      text: "What you are owed, what has come in and how many dancers have paid. The red figure is the money you can chase today.",
    },
    {
      to: "/app",
      target: "views",
      title: "Four ways to look",
      text: "Switch between the Table and the Chart. The Table groups dancers under their batch, each in its own colour.",
    },
    {
      to: "/app",
      target: "import",
      title: "Bring your dancers in",
      text: "Already have a spreadsheet? Import Excel / CSV reads names, phone numbers, batches and fees, and you check them before anything is saved.",
    },
    {
      to: "/app",
      target: "board",
      title: "Everyone in one table",
      text: "Each batch has its own coloured bar with Mark all paid, All present today and Remind unpaid. Click a dancer's name for a panel with their month.",
    },
    {
      to: "/app",
      target: "ticks",
      title: "Mark who is here",
      text: "Tap a tick when a dancer arrives. Press and slide down the column to mark a whole class at once.",
    },
    {
      to: "/app",
      target: "remind",
      title: "Remind in a few taps",
      text: "Remind everyone who owes, or tick a few dancers first. WhatsApp opens each chat with the message ready; you press Send.",
    },
    {
      to: "/app",
      target: "sample",
      title: "Practise first",
      text: "Not sure yet? Try with sample dancers is a made-up studio where nothing is saved or sent. Come back to your own studio any time.",
    },
    {
      to: "/app/students",
      target: "add-dancer",
      title: "Dancers",
      text: "Add dancers one at a time here, or use Paste a list to add many at once, or read them from a photo of your register.",
    },
    {
      to: "/app/billing",
      target: "tabs",
      title: "Payments",
      text: "Charge monthly fees, check payments dancers say they made, send reminders and close the month. These tabs hold each job.",
    },
    {
      to: "/app/attendance",
      target: "attendance",
      title: "Attendance",
      text: "Mark who came to class. Pick a batch and a date, then tap the dancers who missed.",
    },
    {
      to: "/app/batches",
      target: "tabs",
      title: "Studio",
      text: "Set up batches and fee plans, plan make-up classes, invite dance teachers and manage your account from these tabs.",
    },
    {
      to: "/app",
      target: null,
      title: "You are ready",
      text: "Hover over any menu item or button to see what it does. You can replay this tour from the menu.",
    },
  ],
  teacher: [
    {
      target: null,
      title: "Welcome to your studio",
      text: "This takes under a minute. It shows you where to mark attendance, find your batches and plan make-up classes.",
    },
    {
      to: "/app/class",
      target: "attendance",
      title: "Attendance",
      text: "Pick a batch and a date. Everyone starts as present, so tap Absent for the dancers who missed, then save.",
    },
    {
      to: "/app/my-batches",
      target: "batches",
      title: "Batches",
      text: "Your classes: when each one meets and which dancers are in it.",
    },
    {
      to: "/app/makeups",
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

type Box = { top: number; left: number; width: number; height: number };

/**
 * Finds the element for a step, scrolls it into the middle of the screen and keeps a box around it, following
 * it as the page moves or resizes. A page that is still loading is waited for briefly.
 */
function useSpotlight(target: string | null): Box | null {
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    setBox(null);
    if (!target) return undefined;
    let element: HTMLElement | null = null;
    let scrolled = false;
    let tries = 0;

    const measure = () => {
      if (!element || !element.isConnected)
        element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      if (!element) return false;
      if (!scrolled) {
        element.scrollIntoView({ block: "center", behavior: "smooth" });
        scrolled = true;
      }
      const rect = element.getBoundingClientRect();
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      return true;
    };

    const timer = window.setInterval(() => {
      tries += 1;
      const found = measure();
      // Keep following the element for a moment while it scrolls into place, then only when the window changes.
      if ((found && tries > 12) || tries > 40) window.clearInterval(timer);
    }, 120);
    const follow = () => {
      measure();
    };
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
    };
  }, [target]);

  return box;
}

/** Walks through the app one part at a time, dimming the rest of the screen around the part it explains. */
export function GuidedTour({
  role,
  onClose,
  onNavigate,
}: {
  role: TourRole;
  onClose: () => void;
  onNavigate: (to: string) => void;
}) {
  const list = steps[role];
  const [index, setIndex] = useState(0);
  const step = list[index] as Step;
  const last = index === list.length - 1;
  const box = useSpotlight(step.target);

  useEffect(() => {
    if (step.to) onNavigate(step.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function finish() {
    markSeen(role);
    onClose();
  }

  const pad = 6;
  return (
    <>
      {box ? (
        <div
          className="tour-spotlight"
          aria-hidden="true"
          style={{
            top: box.top - pad,
            left: box.left - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
          }}
        />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}
      <div className="tour-card" role="dialog" aria-label="Guided tour" aria-live="polite">
        <p className="tour-step chrome-font">
          Step {index + 1} of {list.length}
        </p>
        <h2 className="display tour-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="console-actions">
          <Button
            variant="retro"
            type="button"
            onClick={() => (last ? finish() : setIndex(index + 1))}
          >
            {last ? "Finish" : "Next"}
          </Button>
          {index > 0 && !last && (
            <Button variant="retroPaper" type="button" onClick={() => setIndex(index - 1)}>
              Back
            </Button>
          )}
          {!last && (
            <Button
              variant="retroPaper"
              type="button"
              title="Close the tour; you can replay it from the menu"
              onClick={finish}
            >
              Skip
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

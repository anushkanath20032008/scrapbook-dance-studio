import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  buildSetupSteps,
  nextSetupStep,
  setupProgress,
  type SetupStep,
} from "@/lib/setup-progress";
import { PasteDancers, usePasteResult } from "@/components/console/paste-dancers";
import { setupCountsKey } from "@/components/console/console-data";
import { getSetupCounts } from "@/lib/setup.functions";

function StepRow({ step, next }: { step: SetupStep; next: boolean }) {
  return (
    <li data-done={step.done} data-next={next}>
      <span className="setup-mark" aria-hidden="true">
        {step.done ? "✓" : next ? "→" : "○"}
      </span>
      <div>
        <strong>{step.title}</strong>
        <span className="console-hint">{step.detail}</span>
      </div>
      <Link to={step.to} className="setup-go">
        {step.done ? "Review" : step.action}
      </Link>
    </li>
  );
}

/**
 * Three steps from an empty studio to a list of who owes this month, ticked from the real data. A studio with no
 * dancers yet gets the paste box right here, because typing the list is the slowest part of starting.
 */
export function SetupChecklist() {
  const load = useServerFn(getSetupCounts);
  const counts = useQuery({ queryKey: setupCountsKey, queryFn: () => load() });
  const [pasted] = usePasteResult();

  if (counts.isError)
    return <p role="alert">Could not load your setup progress. Please refresh.</p>;
  if (!counts.data) return <p>Checking your setup…</p>;

  const steps = buildSetupSteps(counts.data);
  const progress = setupProgress(steps);
  const next = nextSetupStep(steps);
  const required = steps.filter((step) => !step.optional);
  const optional = steps.filter((step) => step.optional);

  return (
    <div>
      {(counts.data.students === 0 || pasted !== null) && <PasteDancers />}
      <p className="setup-progress-label">
        <strong>
          {progress.done} of {progress.total}
        </strong>{" "}
        steps done
      </p>
      <div
        className="setup-bar"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
      >
        <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
      </div>
      <ol className="setup-steps">
        {required.map((step) => (
          <StepRow key={step.id} step={step} next={next?.id === step.id} />
        ))}
      </ol>
      <h3 className="console-subhead setup-later">When you want them</h3>
      <ol className="setup-steps">
        {optional.map((step) => (
          <StepRow key={step.id} step={step} next={false} />
        ))}
      </ol>
    </div>
  );
}

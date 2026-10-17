import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { buildSetupSteps, setupProgress } from "@/lib/setup-progress";
import { setupCountsKey } from "@/components/console/console-data";
import { getSetupCounts } from "@/lib/setup.functions";

/** Five steps from an empty studio to a studio ready for its first month, ticked from the real data. */
export function SetupChecklist() {
  const load = useServerFn(getSetupCounts);
  const counts = useQuery({ queryKey: setupCountsKey, queryFn: () => load() });

  if (counts.isError)
    return <p role="alert">Could not load your setup progress. Please refresh.</p>;
  if (!counts.data) return <p>Checking your setup…</p>;

  const steps = buildSetupSteps(counts.data);
  const progress = setupProgress(steps);

  return (
    <div>
      <p className="setup-progress-label">
        <strong>
          {progress.done} of {progress.total}
        </strong>{" "}
        steps done
      </p>
      <div
        className="setup-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
      >
        <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
      </div>
      <ol className="setup-steps">
        {steps.map((step) => (
          <li key={step.id} data-done={step.done}>
            <span className="setup-mark" aria-hidden="true">
              {step.done ? "✓" : "○"}
            </span>
            <div>
              <strong>{step.title}</strong>
              <span className="console-hint">
                {step.done ? "Done" : "To do"}: {step.detail}
              </span>
            </div>
            <Link to={step.to} className="setup-go">
              {step.done ? "Review" : "Open"}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

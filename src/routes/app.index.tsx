import { createFileRoute } from "@tanstack/react-router";
import { SetupChecklist } from "@/components/console/setup-checklist";

export const Route = createFileRoute("/app/")({
  component: Overview,
});

function Overview() {
  return (
    <section>
      <h1 className="display console-title">Overview</h1>
      <div className="window">
        <div className="window-bar chrome-font">Setup.dialog</div>
        <div className="window-inner">
          <p>
            Set up your studio first. Next up: who hasn&apos;t paid, and how much money is missing.
          </p>
          <SetupChecklist />
        </div>
      </div>
    </section>
  );
}

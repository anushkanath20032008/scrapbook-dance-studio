import { createFileRoute } from "@tanstack/react-router";
import { SetupChecklist } from "@/components/console/setup-checklist";

export const Route = createFileRoute("/app/setup")({
  head: () => ({ meta: [{ title: "Set up your studio | ChoreoStudio" }] }),
  component: Setup,
});

function Setup() {
  return (
    <section>
      <h1 className="display console-title">Set up your studio</h1>
      <div className="window">
        <div className="window-bar chrome-font">Checklist.dialog</div>
        <div className="window-inner">
          <p>
            Three steps and you can see who owes this month: add your dancers, set their fees, create
            this month&apos;s fees. Batches can wait.
          </p>
          <SetupChecklist />
        </div>
      </div>
    </section>
  );
}

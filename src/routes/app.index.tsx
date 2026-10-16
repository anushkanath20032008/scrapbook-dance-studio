import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  component: Overview,
});

function Overview() {
  return (
    <section>
      <h1 className="display console-title">Overview</h1>
      <div className="window">
        <div className="window-bar chrome-font">Welcome.dialog</div>
        <div className="window-inner">
          <p>
            You&apos;re in. Your studio screens are being built one at a time: first setting up your
            fee plans, batches and students, then who hasn&apos;t paid.
          </p>
        </div>
      </div>
    </section>
  );
}

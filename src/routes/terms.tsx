import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms | ChoreoStudio" },
      { name: "description", content: "Terms for using ChoreoStudio." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <main className="section features" style={{ minHeight: "100vh" }}>
      <div className="wrap" style={{ maxWidth: 680 }}>
        <a href="/">← ChoreoStudio</a>
        <h1 className="display" style={{ fontSize: 56, margin: "30px 0" }}>Terms.</h1>
        <div className="window">
          <div className="window-bar chrome-font">Terms.txt</div>
          <div className="window-inner">
            <p>ChoreoStudio is a record-keeping tool for dance studios. It helps you track fees, attendance and batches.</p>
            <p>It does not collect or hold money between dancers and studios. Studio owners confirm payments themselves against their own bank or UPI statement.</p>
            <p>You are responsible for the accuracy of what you enter and for having your dancers' permission to message them.</p>
            <p>Studio subscriptions can be cancelled at any time. On request we send you your records as a spreadsheet.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy | Choreo Studio" },
      { name: "description", content: "What Choreo Studio collects and why." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <main className="section features" style={{ minHeight: "100vh" }}>
      <div className="wrap" style={{ maxWidth: 680 }}>
        <a href="/">← Choreo Studio</a>
        <h1 className="display" style={{ fontSize: 56, margin: "30px 0" }}>Privacy.</h1>
        <div className="window">
          <div className="window-bar chrome-font">Privacy.txt</div>
          <div className="window-inner">
            <p>Waitlist: we keep your studio name, WhatsApp number and the answers you give, only to contact you about the demo and founding offer. <a href="/opt-out">Opt out</a> any time.</p>
            <p>Studio accounts: owners store their dancers' names, phone numbers, fees, payments and attendance. Each studio can see only its own records.</p>
            <p>Payments: Choreo Studio keeps a record only. It does not process or hold dancers' money.</p>
            <p>Payment screenshots sent with a claim are optional and are deleted once the owner decides, or after 30 days.</p>
            <p>We do not sell your data.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

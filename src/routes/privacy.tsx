import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy | ChoreoStudio" },
      { name: "description", content: "What ChoreoStudio collects and why." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <main className="section features" style={{ minHeight: "100vh" }}>
      <div className="wrap" style={{ maxWidth: 680 }}>
        <a href="/">← ChoreoStudio</a>
        <h1 className="display" style={{ fontSize: 56, margin: "30px 0" }}>Privacy.</h1>
        <div className="window">
          <div className="window-bar chrome-font">Privacy.txt</div>
          <div className="window-inner">
            <p>Walkthrough requests: we keep your studio name, WhatsApp number and the answers you give, only to contact you about your walkthrough. <a href="/opt-out">Opt out</a> any time.</p>
            <p>Studio accounts: owners store their dancers' names, phone numbers, fees, payments and attendance. Each studio can see only its own records.</p>
            <p>Payments: ChoreoStudio keeps a record only. It does not process or hold dancers' money.</p>
            <p>Payment screenshots sent with a claim are optional and are deleted once the owner decides, or after 30 days.</p>
            <p>Website analytics: on the public pages (home, sign-in, privacy and terms) we use Microsoft Clarity to see how visitors use the site, for example where they click. It is not loaded inside the studio console or on dancers' private links, so it never records dancers' names, numbers or payments.</p>
            <p>We do not sell your data.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

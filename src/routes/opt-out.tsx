import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { LegalPage } from "@/components/legal-page";
import { optOutByNumber, optOutWaitlist } from "@/lib/waitlist.functions";

export const Route = createFileRoute("/opt-out")({
  head: () => ({
    meta: [
      { title: "Opt out | ChoreoStudio" },
      { name: "description", content: "Stop being contacted about your ChoreoStudio walkthrough request." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OptOut,
});

function OptOut() {
  const optOutToken = useServerFn(optOutWaitlist);
  const optOutNumber = useServerFn(optOutByNumber);
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function byNumber(event: FormEvent) {
    event.preventDefault();
    if (!/^\+?[0-9\s-]{10,18}$/.test(number.trim())) {
      setStatus("Enter the WhatsApp number you gave us, with 10 digits.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await optOutNumber({ data: { number } });
      // Also clears this browser's saved link if there is one.
      const token = new URLSearchParams(location.search).get("token") ?? localStorage.getItem("choreoOptOut");
      if (token) await optOutToken({ data: { token } }).catch(() => undefined);
      localStorage.removeItem("choreoOptOut");
      setStatus("Done. If that number was on our list, it has been removed and we won't contact you about it.");
    } catch {
      setStatus("Could not update your preference. Please try again, or email support@choreostudio.live.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <LegalPage title="Opt out." windowTitle="Preference.dialog" updated="23 October 2026">
      <p>
        Stop being contacted about a walkthrough request you made on our website. It works on any phone or computer:
        type the WhatsApp number you gave us.
      </p>
      <form onSubmit={byNumber}>
        <label className="form-label">
          WhatsApp number
          <input
            className="field"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 ..."
            value={number}
            onChange={(event) => {
              setNumber(event.target.value);
              setStatus("");
            }}
            maxLength={18}
          />
        </label>
        <div style={{ marginTop: 14 }}>
          <Button variant="retro" type="submit" disabled={busy}>
            {busy ? "One moment…" : "Opt out"}
          </Button>
        </div>
      </form>
      <p role="status">{status}</p>
      <p className="console-hint">
        You can also email <a href="mailto:support@choreostudio.live">support@choreostudio.live</a> and we will remove
        your details.
      </p>
    </LegalPage>
  );
}

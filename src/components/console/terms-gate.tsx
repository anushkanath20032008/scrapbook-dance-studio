import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { FormAlert } from "@/components/console/form-helpers";
import { TermsAgreement } from "@/components/terms-agreement";
import { supabase } from "@/integrations/supabase/client";
import { TERMS_VERSION } from "@/lib/terms";

/** Shown once to any signed-in account that has not agreed to the current terms (older accounts, Google sign-in). */
export function TermsGate({ onAccepted }: { onAccepted: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setBusy(true);
    setError("");
    const { error: failure } = await supabase.auth.updateUser({
      data: { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() },
    });
    setBusy(false);
    if (failure) setError("Could not save your agreement. Please try again.");
    else onAccepted();
  }

  return (
    // It cannot be closed without choosing: agree, or sign out.
    <ConsoleDialog open onOpenChange={() => undefined} title="Terms of Service">
      <div className="console-form">
        <p>We have written down the terms for using ChoreoStudio. Please agree to carry on.</p>
        <TermsAgreement accepted={agreed} onChange={setAgreed} />
        <FormAlert message={error} />
        <div className="console-actions">
          <Button variant="retro" type="button" disabled={!agreed || busy} onClick={accept}>
            {busy ? "Saving…" : "Accept and continue"}
          </Button>
          <Button variant="retroPaper" type="button" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </ConsoleDialog>
  );
}

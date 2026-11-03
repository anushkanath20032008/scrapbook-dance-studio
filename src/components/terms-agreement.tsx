import { TERMS_POINTS } from "@/lib/terms";

/**
 * The terms explained in plain words, with a required tick box. Used when registering and as the one-time
 * agreement for accounts that have not agreed yet. The full documents are one tap away.
 */
export function TermsAgreement({
  accepted,
  onChange,
}: {
  accepted: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <section className="terms-agreement" aria-label="Terms in plain words">
      <h3 className="terms-agreement-title">Before you start: the terms in plain words</h3>
      <ul className="terms-points">
        {TERMS_POINTS.map((point) => (
          <li key={point.title}>
            <strong>{point.title}.</strong> {point.body}
          </li>
        ))}
      </ul>
      <p className="console-hint">
        Read the full <a href="/terms" target="_blank" rel="noreferrer">Terms of Use</a> and{" "}
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy Notice</a>.
      </p>
      <label className="terms-accept">
        <input type="checkbox" checked={accepted} onChange={(event) => onChange(event.target.checked)} />
        <span>I have read and I accept the Terms of Use and the Privacy Notice.</span>
      </label>
    </section>
  );
}

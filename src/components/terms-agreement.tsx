/** The usual sign-up line: one tick box, with the full documents on their own pages. */
export function TermsAgreement({
  accepted,
  onChange,
}: {
  accepted: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="terms-accept">
      <input type="checkbox" checked={accepted} onChange={(event) => onChange(event.target.checked)} />
      <span>
        I agree to the{" "}
        <a href="/terms" target="_blank" rel="noreferrer">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" target="_blank" rel="noreferrer">
          Privacy Notice
        </a>
        .
      </span>
    </label>
  );
}

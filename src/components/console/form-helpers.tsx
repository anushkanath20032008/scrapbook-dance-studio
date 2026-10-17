import type { ReactNode } from "react";

/** A labelled input with its error shown right beside it, so it is seen without scrolling. */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="form-label console-field">
      {label}
      {children}
      {error ? (
        <span role="alert" className="console-field-error">
          {error}
        </span>
      ) : hint ? (
        <span className="console-hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function FormAlert({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="login-error">
      {message}
    </p>
  ) : null;
}

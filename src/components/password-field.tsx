import { useState, type ComponentProps } from "react";

/** A password input with a Show/Hide button, so a typo on a phone keyboard can be seen and fixed. */
export function PasswordField(props: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <span className="password-field">
      <input
        {...props}
        className={`field ${props.className ?? ""}`.trim()}
        type={shown ? "text" : "password"}
      />
      <button
        type="button"
        className="password-toggle"
        aria-pressed={shown}
        onClick={() => setShown((value) => !value)}
      >
        {shown ? "Hide" : "Show"}
      </button>
    </span>
  );
}

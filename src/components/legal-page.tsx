import type { ReactNode } from "react";

/** The shell for the Terms and Privacy pages: back link, title, last-updated date and a window of text. */
export function LegalPage({
  title,
  windowTitle,
  updated,
  children,
}: {
  title: string;
  windowTitle: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="section features legal-page">
      <div className="wrap legal-wrap">
        <a className="legal-back" href="/">← ChoreoStudio</a>
        <h1 className="display legal-title">{title}</h1>
        <p className="legal-meta">Last updated {updated}</p>
        <div className="window">
          <div className="window-bar chrome-font">{windowTitle}</div>
          <div className="window-inner">{children}</div>
        </div>
        <p className="legal-foot">
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="mailto:support@choreostudio.live">Contact</a>
        </p>
      </div>
    </main>
  );
}

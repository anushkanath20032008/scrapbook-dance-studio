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
    <main className="section features legal-page" style={{ minHeight: "100vh" }}>
      <div className="wrap" style={{ maxWidth: 760 }}>
        <a href="/">← ChoreoStudio</a>
        <h1 className="display" style={{ fontSize: 56, margin: "30px 0 8px" }}>
          {title}
        </h1>
        <p className="legal-meta">Last updated {updated}</p>
        <div className="window">
          <div className="window-bar chrome-font">{windowTitle}</div>
          <div className="window-inner">{children}</div>
        </div>
      </div>
    </main>
  );
}

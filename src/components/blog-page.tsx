import type { ReactNode } from "react";

/** Shell for blog pages: same retro window as the legal pages, plus a Blog crumb and the footer links. */
export function BlogShell({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <main className="section features legal-page blog-page">
      <div className="wrap legal-wrap">
        <nav aria-label="Breadcrumb">
          <a className="legal-back" href="/">← ChoreoStudio</a>
          {" · "}
          <a className="legal-back" href="/blog">Blog</a>
        </nav>
        <h1 className="display legal-title">{title}</h1>
        {meta && <p className="legal-meta">{meta}</p>}
        {children}
        <p className="legal-foot">
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="mailto:support@choreostudio.live">Contact</a>
        </p>
      </div>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { BlogShell } from "@/components/blog-page";
import { SITE, posts } from "@/content/blog";

const title = "Dance studio fee guides | ChoreoStudio blog";
const description =
  "Practical guides for dance studio owners: tracking monthly fees, matching cash, UPI and bank payments, reminder messages, late-payment rules and a month-end checklist.";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/blog` },
      { property: "og:image", content: `${SITE}/og.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/blog` }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <BlogShell title="Blog.">
      <p className="legal-meta">Fee guides for dance studio owners.</p>
      <ul className="blog-list">
        {posts.map((post) => (
          <li key={post.slug} className="window">
            <div className="window-bar chrome-font">{post.date}</div>
            <div className="window-inner">
              <h2><a href={`/blog/${post.slug}`}>{post.title}</a></h2>
              <p>{post.description}</p>
              <p className="legal-meta">{post.readingMinutes} min read</p>
            </div>
          </li>
        ))}
      </ul>
    </BlogShell>
  );
}

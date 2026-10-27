import { createFileRoute, notFound } from "@tanstack/react-router";
import { BlogShell } from "@/components/blog-page";
import { SITE, getPost, postSchema, type Block } from "@/content/blog";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getPost(params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const url = `${SITE}/blog/${loaderData.slug}`;
    return {
      meta: [
        { title: loaderData.metaTitle },
        { name: "description", content: loaderData.description },
        { property: "og:title", content: loaderData.metaTitle },
        { property: "og:description", content: loaderData.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: `${SITE}/og.png` },
        { property: "article:published_time", content: loaderData.date },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(postSchema(loaderData)) }],
    };
  },
  notFoundComponent: () => (
    <BlogShell title="That post isn't here.">
      <p><a href="/blog">See all posts</a></p>
    </BlogShell>
  ),
  component: BlogPost,
});

function render(block: Block, key: number) {
  switch (block.t) {
    case "p": return <p key={key}>{block.text}</p>;
    case "h2": return <h2 key={key}>{block.text}</h2>;
    case "h3": return <h3 key={key}>{block.text}</h3>;
    case "ul": return <ul key={key}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
    case "ol": return <ol key={key}>{block.items.map((item) => <li key={item}>{item}</li>)}</ol>;
    case "msg":
      return (
        <figure key={key} className="blog-msg">
          <figcaption>{block.label} · Sample message</figcaption>
          <blockquote>{block.text}</blockquote>
        </figure>
      );
    case "note": return <p key={key} className="console-banner">{block.text} <a href="/login?mode=register">Start free trial</a></p>;
  }
}

function BlogPost() {
  const post = Route.useLoaderData();
  const date = new Date(`${post.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <BlogShell title={post.title} meta={`${date} · ${post.readingMinutes} min read · by ChoreoStudio`}>
      <article className="window">
        <div className="window-bar chrome-font">{post.slug}.txt</div>
        <div className="window-inner">
          {post.blocks.map(render)}
          {post.faq && (
            <>
              <h2>Quick answers</h2>
              {post.faq.map((item) => (
                <div key={item.q}>
                  <h3>{item.q}</h3>
                  <p>{item.a}</p>
                </div>
              ))}
            </>
          )}
          {post.sources && (
            <>
              <h2>Sources</h2>
              <ul>
                {post.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} rel="noopener noreferrer" target="_blank">{source.label}</a>. {source.note}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </article>
    </BlogShell>
  );
}

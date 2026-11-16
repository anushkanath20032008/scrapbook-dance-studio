# SEO, AEO and GEO changes (branch `feat/seo-aeo-geo`)

Written 2026-10-27. Nothing is pushed or published. The changes go live only when this branch is merged and deployed.

Guided by the Product Discovery Playbook's three layers: SEO (pages that are easy to find and useful), AEO (clear answers to real customer questions) and GEO (product facts that AI tools can find, check and cite). The playbook page itself only gave these rules at a high level: no keyword stuffing, no opaque scores, no guaranteed rankings, publish helpful content, then measure and adjust. This work follows them. **No post is promised to rank.** A new domain with no links ranks slowly.

## What changed
| Layer | Change | Where |
|---|---|---|
| SEO | Home page structured data: Organization, WebSite, SoftwareApplication (two INR offers, no ratings or reviews) | `src/lib/seo.ts`, `src/routes/index.tsx` |
| SEO | Canonical and Open Graph tags on Privacy and Terms | `src/routes/privacy.tsx`, `src/routes/terms.tsx` |
| SEO | `/opt-out` set to noindex; `/login` removed from the sitemap (it is noindex, so listing it was a contradiction) | `src/routes/opt-out.tsx`, `public/sitemap.xml` |
| SEO | One `robots.txt` group that blocks private areas (`/app`, `/admin`, `/account`, `/family/`, `/reset-password`, `/api/`) and keeps the sitemap line | `public/robots.txt` |
| SEO | Sitemap has `lastmod` and the three new posts | `public/sitemap.xml` |
| SEO | "Keep reading" links at the end of each post, so every post links to three others | `src/routes/blog.$slug.tsx`, `src/content/blog.ts` |
| AEO | FAQPage markup for the home FAQ, generated from the same data as the visible FAQ so they cannot drift | `src/lib/home-faq.ts` |
| AEO | Three new posts, each with a "Quick answers" block and FAQ markup | `src/content/blog.ts` |
| GEO | `/llms.txt`: one-line description, plain facts (pricing as of October 2026, what the product does and does not do, data location) and links to every guide | `public/llms.txt` |

Note on FAQ markup: Google stopped showing FAQ rich results in 2026, so the home FAQPage markup will not earn a special result there. It stays because it matches visible text and other readers (Bing, AI answer tools) can use it.

## New posts (all dated 2026-10-27)
1. `/blog/dance-class-late-payment-policy`: write the fee rule once (due date, grace period, reminder, next step). Late-fee advice stays general and tells the owner to check the rules for their business. No outside facts are used.
2. `/blog/month-end-checklist-dance-studio-owner`: a printable checklist, with a pointer to the Month end page.
3. `/blog/dance-studio-whatsapp-group-tips`: announcements group vs chat, fees in private messages.

The claim checker passes on all three posts and on `llms.txt`. Not written yet: "monthly, per class or bundle fee plans" (needs a check of what the app supports) and city pages (need real local data).

## Checked
Type-check clean, 384 tests pass, build passes. Rendered pages checked on the dev server: titles, canonicals, noindex on `/opt-out`, JSON-LD types on the home page and each post, and the "Keep reading" block. **Not checked:** Google's Rich Results Test and the Schema.org validator (they need the live URL), and PageSpeed (needs the live site).

## What only you can do (after deploy)
1. **Google Search Console**: add `choreostudio.live`, submit `https://choreostudio.live/sitemap.xml`, and use URL Inspection > Request indexing on `/`, `/blog` and the six posts.
2. **Bing Webmaster Tools**: import the site from Search Console and submit the sitemap. Bing feeds several AI answer tools.
3. Paste the home URL and one post URL into the Rich Results Test and the Schema.org validator. Fix anything they flag.
4. Run PageSpeed Insights on `/` and one post, mobile. Send me the numbers and I will fix what they point to.
5. Keep the same one-line description ("fee tracking and WhatsApp reminders for dance studio owners") on Instagram, LinkedIn and any directory listing.

## How to measure (monthly, 15 minutes)
- Search Console: impressions, clicks, queries and which page gets them. Under about 30 visits a month, say "too few to read".
- Ask ChatGPT, Perplexity and Google five questions a studio owner would ask (for example "how do I track monthly dance class fees in India"). Run each three times. Note whether ChoreoStudio is cited, and write down what the answer gets wrong. Fix the page that should have said it.
- Add new links you see in Search Console's Links report to `growth/backlinks.csv`.

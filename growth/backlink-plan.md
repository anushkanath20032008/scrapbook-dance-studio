# Blog and backlink plan (SEO, AEO, GEO)

Written 2026-10-24. **Nothing is published or sent.** The blog is built on branch `feat/blog` and goes live only when that branch is merged and deployed.

**Honest framing.** I have no search volumes, no Search Console and no keyword tool, so I can't say any post will rank. A brand-new domain with no links ranks slowly. Backlinks (other sites linking to you) are the slow, important part. This plan lists only methods that earn links; it does not buy, swap or fake them. Every target below is an idea to check, not a verified contact.

## 1. What is built
| URL | What it is | Why it exists |
|---|---|---|
| `/blog` | Index of posts | Hub page that links to every post |
| `/blog/track-monthly-dance-class-fees` | Fee routine plus 3 messages (main post from the outline) | Core keyword: dance class fee tracking |
| `/blog/reconcile-cash-upi-bank-dance-class-fees` | Matching cash, UPI and bank at month end | Pain keyword unique to India |
| `/blog/dance-class-fee-reminder-messages` | 9 copy-and-paste messages | **Linkable asset**: people link to and share templates |

Each post has: its own title and description, a canonical tag, Open Graph tags, Article, Breadcrumb and FAQ structured data, and a short "Quick answers" block (the shape Google and AI answers quote). They are added to `sitemap.xml` and linked from the footer. Sources are named, dated and labelled as vendor blogs where they are.

## 2. Before you publish (10 minutes)
1. Read the three posts. Tell me what to change. The WhatsApp consent section from the outline is **left out** until we have a primary source.
2. Merge `feat/blog`, deploy, then check `choreostudio.live/blog` and one post load.
3. In **Google Search Console**: add the domain, submit `https://choreostudio.live/sitemap.xml`, and use "Request indexing" on the three posts and `/blog`.
4. In **Bing Webmaster Tools**: import from Search Console. (Bing feeds several AI answer tools.)
5. Add the `choreostudio.live/blog` link in the Instagram bio highlights and the LinkedIn Featured section.

## 3. Backlink tactics, in the order I'd do them
Do the first three this week; they take little time and carry no risk.

| # | Tactic | What to do | Effort | Expect |
|---|---|---|---|---|
| 1 | **Your own profiles** | Link the site from Instagram, LinkedIn (personal and a company page), a Google Business Profile if you want one, X, YouTube. Use the UTM table for tracking. | 30 min | Low-value but real, and it makes search engines trust the brand name |
| 2 | **Startup and product listings** | Submit to places that list new products, such as Product Hunt, BetaList, AlternativeTo, G2 and Capterra (free profile), SaaSHub, and Indian startup directories. Check each one's rules and whether they accept a pre-revenue tool. | 2 hours | A few links, and some referral visits. Quality varies |
| 3 | **Indie and founder communities** | A "Show" style post on Indie Hackers and Hacker News, and Indian founder groups on LinkedIn. Tell the real story (solo founder, built for dance studios). No spammy link drops. | 1 hour | Some links and early feedback |
| 4 | **Dance communities (earn it)** | Be useful in dance teacher groups, subreddits and Facebook groups: answer fee questions, and share the reminder-messages page only where links are allowed. Read each group's rules first. | 15 min a day | Links come slowly and only if you help first |
| 5 | **Studio and teacher newsletters, blogs and podcasts** | Offer a guest post or a short interview: "A fee routine for studio owners", using post 1 as the draft. Find 10 dance blogs, teacher newsletters and small-business podcasts in India. | 3 hours to find and pitch | The best links. Expect a low reply rate |
| 6 | **Quote requests** | Sign up to journalist-quote services (for example Qwoted, Featured, Help a B2B Writer) for small-business and India topics. Answer only where you really know the subject. | 20 min a day | Occasional press links |
| 7 | **Partnerships** | Dance-wear shops, music-class suppliers, studio-rental listings, and dance event pages sometimes link to useful tools for their audience. Offer the templates page as a free resource. | 2 hours | A few relevant links |
| 8 | **Free tools** | Build a free "fee reminder message generator" or "monthly fee calculator" page. Free tools attract links more than blog posts do. Say the word and I'll build it. | 1 to 2 days | Best long-term linkable asset |
| 9 | **Real customers** | Once a studio is happy, ask them to link to you from their site or tag you on Instagram. Never ask for a link in exchange for a discount without disclosing it, and never write a testimonial for them. | n/a | High value, only after you have customers |

## 4. What not to do
- Buy links, join link-exchange schemes, use "SEO packages", or post comments only to leave a link. These risk a Google penalty.
- Invent studios, reviews, quotes, counts or results anywhere. The claim rules still apply.
- Copy other sites' articles. The posts use our own wording; outside facts are cited with links.
- Link everything to `/login`. Link to the blog posts and the home page, and keep one call to action per post.

## 5. Measure it (monthly, 15 minutes)
- Google Search Console: impressions, clicks, queries and which post gets them.
- Clarity: visits by `utm_source` (blog, instagram, linkedin) and which posts lead to "Start free trial".
- Backlinks: Search Console's Links report shows who links to you for free. Note new ones in `growth/backlinks.csv` (date, linking page, how we got it).
- Below 30 visits a month, say "too few to read".

## 6. Next posts (queue)
Written 2026-10-27 on `feat/seo-aeo-geo`: late-payment rule, month-end checklist, WhatsApp group tips (see `growth/seo-changes.md`).
Still queued:
1. "Fee plans for dance classes: monthly, per class, or a bundle" (write only after checking what the app supports).
2. City pages (for example "dance class fees in Mumbai") only when you really have local studio data, to avoid thin pages.
3. A free fee-reminder message generator page (the best linkable asset; say the word).

## 7. For answer engines and AI search (AEO and GEO)
- Each post answers one question in its first lines and ends with a "Quick answers" block of short, standalone answers. That is the form that gets quoted.
- Use the same name, **ChoreoStudio**, and the same one-line description everywhere: "fee tracking and WhatsApp reminders for dance studio owners".
- The site's structured data tells machines who published each post (an Organization) and the page's questions and answers.
- Keep outside facts cited. Pages with named, dated sources are more likely to be trusted and quoted.

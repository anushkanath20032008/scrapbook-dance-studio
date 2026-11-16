import { homeFaq } from "@/lib/home-faq";

export const SITE_URL = "https://www.choreostudio.live";
export const ONE_LINER = "Fee tracking and WhatsApp reminders for dance studio owners.";

/**
 * JSON-LD for the home page. Describes only what the page says: no ratings, reviews or customer counts.
 * FAQPage is semantic markup for the visible FAQ; Google no longer shows FAQ rich results, but other
 * readers (Bing, AI answer tools) still use it.
 */
export function homeSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: "ChoreoStudio",
        url: SITE_URL,
        logo: `${SITE_URL}/logo-mark.svg`,
        description: ONE_LINER,
        email: "support@choreostudio.live",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#site`,
        name: "ChoreoStudio",
        url: SITE_URL,
        inLanguage: "en-IN",
        publisher: { "@id": `${SITE_URL}/#org` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: "ChoreoStudio",
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Shows which dancers have paid, who is due and who is overdue, and opens a WhatsApp reminder with each dancer's amount filled in. The studio owner presses Send. ChoreoStudio keeps the record only and never holds dancers' money.",
        publisher: { "@id": `${SITE_URL}/#org` },
        offers: [
          { "@type": "Offer", name: "Regular (up to 50 dancers)", price: "249", priceCurrency: "INR", url: `${SITE_URL}/#pricing` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: homeFaq.map(([q, a]) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };
}

/** Standard head tags for a simple indexable page: title, description, canonical, Open Graph. */
export function pageHead(path: string, title: string, description: string) {
  const url = `${SITE_URL}${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:image", content: `${SITE_URL}/og.png` },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

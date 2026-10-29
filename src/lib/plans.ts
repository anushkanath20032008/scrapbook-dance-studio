// ChoreoStudio's own subscription tiers. Ids match the plans accepted by createSubscriptionCheckout. "growth" is
// an older tier that is no longer sold; it stays in the type so existing subscriptions and webhooks keep working.
export type StudioPlanId = "starter" | "growth" | "studio";

export const FREE_TRIAL = "Free for your first month";

/** The plans on sale: Regular (id "starter") and Studio+ (id "studio"). */
export const studioPlans: readonly {
  id: StudioPlanId;
  name: string;
  price: string;
  features: readonly string[];
  /** Not ready to buy yet: shown with a "Coming soon" tag and no checkout. */
  comingSoon?: boolean;
}[] = [
  {
    id: "starter",
    name: "Regular",
    price: "₹249",
    features: [
      "Up to 50 dancers",
      "Fees, attendance and batches",
      "A WhatsApp reminder for each unpaid dancer, amount filled in",
      "Dancer payment claims",
      "Monthly trend reports",
    ],
  },
  {
    id: "studio",
    name: "Studio+",
    price: "₹479",
    comingSoon: true,
    features: [
      "More than 50 dancers",
      "Everything in Regular",
      "Automated WhatsApp messages from your own WhatsApp Business account (coming soon)",
      "Priority support",
    ],
  },
];

export const subscriptionNote =
  "This subscription is for the studio using ChoreoStudio. Dancer payments are ledger-only and are not processed by ChoreoStudio.";

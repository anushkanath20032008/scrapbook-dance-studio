// Choreo Studio's own subscription tiers. Ids match the plans accepted by createSubscriptionCheckout.
export const studioPlans = [
  {
    id: "starter",
    name: "Starter",
    price: "₹999",
    features: [
      "Up to 50 students",
      "Fees, attendance and batches",
      "WhatsApp reminders",
      "Dancer payment claims",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: "₹1,999",
    features: ["Up to 150 students", "Everything in Starter", "Monthly trend reports"],
  },
  {
    id: "studio",
    name: "Studio+",
    price: "₹3,999",
    features: [
      "150+ students",
      "Everything in Growth",
      "Dancer logins with invites",
      "Priority support",
    ],
  },
] as const;

export type StudioPlanId = (typeof studioPlans)[number]["id"];

export const subscriptionNote =
  "This subscription is for the studio using ChoreoStudio. Student payments are ledger-only and are not processed by ChoreoStudio.";

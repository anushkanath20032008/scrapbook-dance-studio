import { createFileRoute } from "@tanstack/react-router";
import { InsightsPanel } from "@/components/console/insights-panel";

export const Route = createFileRoute("/app/insights")({
  head: () => ({ meta: [{ title: "Insights | ChoreoStudio" }] }),
  component: InsightsPanel,
});

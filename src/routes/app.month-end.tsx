import { createFileRoute } from "@tanstack/react-router";
import { MonthEndPanel } from "@/components/console/month-end-panel";

export const Route = createFileRoute("/app/month-end")({
  head: () => ({ meta: [{ title: "Month end | ChoreoStudio" }] }),
  component: MonthEndPanel,
});

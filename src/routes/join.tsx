import { createFileRoute } from "@tanstack/react-router";
import { JoinFlow } from "@/components/member/join-flow";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join your studio | Choreo Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => <JoinFlow />,
});

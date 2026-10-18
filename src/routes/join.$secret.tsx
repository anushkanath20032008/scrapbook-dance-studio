import { createFileRoute } from "@tanstack/react-router";
import { JoinFlow } from "@/components/member/join-flow";

export const Route = createFileRoute("/join/$secret")({
  head: () => ({
    meta: [
      { title: "Join your studio | Choreo Studio" },
      { name: "robots", content: "noindex,nofollow" },
      // The invite link is a secret: never send it on as a referrer.
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: JoinLink,
});

function JoinLink() {
  const { secret } = Route.useParams();
  return <JoinFlow linkSecret={secret} />;
}

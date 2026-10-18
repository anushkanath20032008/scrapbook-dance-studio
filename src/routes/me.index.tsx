import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { messageOf } from "@/components/console/form-utils";
import { listMyStudios } from "@/lib/members.functions";

export const Route = createFileRoute("/me/")({
  component: MyStudios,
});

function MyStudios() {
  const navigate = useNavigate();
  const load = useServerFn(listMyStudios);
  const studios = useQuery({ queryKey: ["my-studios"], queryFn: () => load(), retry: false });

  // One studio needs no picker.
  const only = studios.data?.length === 1 ? studios.data[0] : undefined;
  useEffect(() => {
    if (only)
      void navigate({ to: "/me/$studioId", params: { studioId: only.studio_id }, replace: true });
  }, [only, navigate]);

  if (studios.isPending || only) return <p>Loading…</p>;
  if (studios.isError)
    return (
      <p className="login-error" role="alert">
        {messageOf(studios.error)}
      </p>
    );
  if (studios.data.length === 0) {
    return (
      <>
        <h1 className="display login-title">No studio yet.</h1>
        <p>
          Your studio gives you an invite link or a code. <Link to="/join">Enter your code</Link>.
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="display login-title">Your studios.</h1>
      <ul className="console-list">
        {studios.data.map((studio) => (
          <li key={studio.studio_id} className="console-row">
            <Link to="/me/$studioId" params={{ studioId: studio.studio_id }}>
              <strong>{studio.studio_name}</strong>
            </Link>
          </li>
        ))}
      </ul>
      <p className="console-hint">
        Got another invite? <Link to="/join">Enter a code</Link>.
      </p>
    </>
  );
}

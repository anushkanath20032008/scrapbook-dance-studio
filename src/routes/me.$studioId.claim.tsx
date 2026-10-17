import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClaimForm } from "@/components/claim-form";
import { messageOf } from "@/components/console/form-utils";
import { getMemberView, submitMemberClaim } from "@/lib/members.functions";
import { memberClaimInput } from "@/lib/schemas";

export const Route = createFileRoute("/me/$studioId/claim")({
  component: ClaimPage,
});

function ClaimPage() {
  const { studioId } = Route.useParams();
  const load = useServerFn(getMemberView);
  const submit = useServerFn(submitMemberClaim);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const view = useQuery({
    queryKey: ["member-view", studioId],
    queryFn: () => load({ data: { studioId } }),
    retry: false,
  });

  if (view.isPending) return <p>Loading…</p>;
  if (view.isError)
    return (
      <p className="login-error" role="alert">
        {messageOf(view.error)}
      </p>
    );

  return (
    <>
      <p className="console-hint">{view.data.studio_name ?? "Your studio"}</p>
      <h1 className="display login-title">I&apos;ve paid.</h1>
      {notice ? (
        <>
          <p role="status" className="console-notice">
            ✓ {notice}
          </p>
          <p>
            <Link to="/me/$studioId" params={{ studioId }}>
              Back to my classes and fees
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="console-hint">
            This tells your studio about a payment. Your balance changes only after they check it.
          </p>
          <ClaimForm
            students={view.data.students.map((student) => ({ id: student.id, name: student.name }))}
            parse={(fields) => memberClaimInput.safeParse({ studioId, ...fields })}
            send={(data) => submit({ data })}
            onSent={() => {
              void queryClient.invalidateQueries({ queryKey: ["member-claims", studioId] });
            }}
            onDone={setNotice}
            onCancel={() => window.history.back()}
          />
        </>
      )}
    </>
  );
}

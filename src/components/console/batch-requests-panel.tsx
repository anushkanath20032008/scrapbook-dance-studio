import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { messageOf, weekdayNames } from "@/components/console/form-utils";
import {
  approveBatchRequest,
  declineBatchRequest,
  listBatchRequests,
} from "@/lib/instructors.functions";

const clock = (value: string | null) => (value ? value.slice(0, 5) : "");

export function describeRequest(request: {
  weekdays: number[];
  starts_at: string | null;
  ends_at: string | null;
  room: string | null;
}) {
  const days = request.weekdays.map((day) => weekdayNames[day]).join(", ");
  const time = request.starts_at
    ? `${clock(request.starts_at)}${request.ends_at ? `–${clock(request.ends_at)}` : ""}`
    : "";
  return [days, time, request.room].filter(Boolean).join(" · ") || "No schedule given";
}

/** Batches the studio's teachers have suggested. The owner approves or declines each one. */
export function BatchRequestsPanel({ onApproved }: { onApproved: () => void }) {
  const queryClient = useQueryClient();
  const list = useServerFn(listBatchRequests);
  const approve = useServerFn(approveBatchRequest);
  const decline = useServerFn(declineBatchRequest);
  const [error, setError] = useState("");
  const requests = useQuery({ queryKey: ["batch-requests"], queryFn: () => list() });

  const done = () => void queryClient.invalidateQueries({ queryKey: ["batch-requests"] });
  const approveMutation = useMutation({
    mutationFn: (id: string) => approve({ data: { id } }),
    onSuccess: () => {
      toast.success("Batch added.");
      setError("");
      done();
      onApproved();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const declineMutation = useMutation({
    mutationFn: (id: string) => decline({ data: { id } }),
    onSuccess: () => {
      setError("");
      done();
    },
    onError: (e) => setError(messageOf(e)),
  });

  const waiting = (requests.data ?? []).filter((request) => request.status === "pending");
  const decided = (requests.data ?? []).filter((request) => request.status !== "pending").slice(0, 5);
  if (waiting.length === 0 && decided.length === 0) return null;

  return (
    <section aria-label="Batch requests from teachers" className="console-notice-box">
      <h2 className="console-subtitle">
        Requests from teachers{waiting.length > 0 ? ` (${waiting.length} waiting)` : ""}
      </h2>
      {error && <p role="alert">{error}</p>}
      <ul className="console-list">
        {waiting.map((request) => (
          <li key={request.id} className="console-row">
            <div>
              <strong>{request.name}</strong>
              <span className="console-hint">
                {describeRequest(request)}
                {request.requester_email ? ` · from ${request.requester_email}` : ""}
              </span>
            </div>
            <div className="console-row-actions">
              <Button
                variant="retro"
                type="button"
                disabled={approveMutation.isPending || declineMutation.isPending}
                onClick={() => approveMutation.mutate(request.id)}
              >
                Approve
              </Button>
              <Button
                variant="retroPaper"
                type="button"
                disabled={approveMutation.isPending || declineMutation.isPending}
                onClick={() => declineMutation.mutate(request.id)}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
        {decided.map((request) => (
          <li key={request.id} className="console-row" data-archived="true">
            <div>
              <strong>{request.name}</strong>
              <span className="console-hint">{describeRequest(request)}</span>
            </div>
            <span className="status-pill" data-tone={request.status === "approved" ? "good" : "idle"}>
              {request.status === "approved" ? "Approved" : "Declined"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

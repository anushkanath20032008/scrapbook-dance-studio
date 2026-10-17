import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { createFamilyLink, listFamilyLinks, revokeFamilyLink } from "@/lib/family.functions";

/** A private link a dancer opens to see their classes and fees and to report a payment. Shown once, revocable. */
export function FamilyLinkSection({ guardianId }: { guardianId: string }) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createFamilyLink);
  const listFn = useServerFn(listFamilyLinks);
  const revokeFn = useServerFn(revokeFamilyLink);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const links = useQuery({
    queryKey: ["family-links", guardianId],
    queryFn: () => listFn({ data: { guardianId } }),
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["family-links", guardianId] });

  const create = useMutation({
    mutationFn: () => createFn({ data: { guardianId } }),
    onSuccess: ({ url: created }) => {
      setUrl(created);
      setCopied(false);
      setError("");
      refresh();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      setUrl("");
      refresh();
    },
    onError: (e) => setError(messageOf(e)),
  });

  const active = (links.data ?? []).filter((link) => link.revoked_at === null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <h3>Private link</h3>
      <p className="console-hint">
        Send this to the dancer. They see their classes and fees and can report a payment. It is
        shown once; anyone with it has access, so revoke it if it leaks.
      </p>
      {url && (
        <div className="link-box">
          <input
            className="field"
            readOnly
            value={url}
            aria-label="Private link"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button variant="retroPaper" type="button" onClick={copy}>
            {copied ? "Copied ✓" : "Copy"}
          </Button>
        </div>
      )}
      <div className="console-actions">
        <Button
          variant="retroPaper"
          type="button"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          {active.length > 0 ? "Create another link" : "Create link"}
        </Button>
        {active.length > 0 && (
          <Button
            variant="retroPaper"
            type="button"
            disabled={revoke.isPending}
            onClick={() => {
              for (const link of active) revoke.mutate(link.id);
            }}
          >
            Revoke {active.length === 1 ? "link" : `all ${active.length} links`}
          </Button>
        )}
      </div>
      <FormAlert message={error} />
    </>
  );
}

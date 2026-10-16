import { useQueryClient } from "@tanstack/react-query";

export const setupCountsKey = ["setup-counts"] as const;

/** Everything a student change can touch: the list, guardians, batch and plan counts and the checklist. */
export function useRefreshStudents() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["students-overview", "guardians", "batches", "fee-plans"])
      void queryClient.invalidateQueries({ queryKey: [key] });
    void queryClient.invalidateQueries({ queryKey: setupCountsKey });
  };
}

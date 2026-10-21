import { useQueryClient } from "@tanstack/react-query";

export const setupCountsKey = ["setup-counts"] as const;

/** Everything a student change can touch: the list, guardians, batch and plan counts and the checklist. */
export function useRefreshStudents() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["students-overview", "guardians", "batches", "fee-plans", "console-context"])
      void queryClient.invalidateQueries({ queryKey: [key] });
    void queryClient.invalidateQueries({ queryKey: setupCountsKey });
  };
}

/** Everything a payment or void can change: Home's totals, the unpaid list and one dancer's billing. */
export function useRefreshMoney() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["home-report", "student-charges", "student-payments", "payment-check"])
      void queryClient.invalidateQueries({ queryKey: [key] });
  };
}

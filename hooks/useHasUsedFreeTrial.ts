import { useQuery } from "@tanstack/react-query";

import { getMyOrganizations } from "@/client-api/functions/organizations";
import { useAuthStore } from "@/stores/authStore";

// The backend dedupes a free trial by the owner who started it (see
// findPriorOwnerTrial), across every organisation they've ever created --
// not per-organisation. Checking every organisation this user belongs to
// for one they personally started a trial on tells us upfront whether a
// trial is actually available, instead of waiting for the backend to
// reject a doomed attempt.
export function useHasUsedFreeTrial() {
  const user = useAuthStore((state) => state.user);

  const { data, isLoading } = useQuery({
    queryKey: ["my-organizations", "trial-check", user?._id],
    queryFn: getMyOrganizations,
    enabled: Boolean(user?._id),
    staleTime: 60_000
  });

  const hasUsedTrial = Boolean(
    user?._id &&
      data?.data.organizations.some(
        (organization) => organization.trialStartedBy === user._id
      )
  );

  return { hasUsedTrial, isLoading };
}

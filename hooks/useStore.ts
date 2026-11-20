import { useQuery } from "@tanstack/react-query";

import { getStore } from "@/client-api/functions/stores";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { isNotFoundError } from "@/lib/store";
import { useOrganizationStore } from "@/stores/organizationStore";

export const storeQueryKey = (organizationId?: string) => [
  "store",
  organizationId
];

/**
 * GET /organizations/stores. Until the store backend is live in production
 * the route answers 404, and the Store page and its menu item stay hidden;
 * only a 200 shows them. Queries never toast errors, so a 404 stays silent.
 *
 * `fresh` refetches when the caller mounts (the Store page); the layout
 * leaves it off so the menu asks only once per session.
 */
export function useStore({ fresh = false }: { fresh?: boolean } = {}) {
  const organizationId = useOrganizationStore(
    (state) => state.activeOrganization?._id
  );
  const { can, isLoading: isMembershipLoading } = useCurrentMembership();
  const canView = can("integrations:view");
  const query = useQuery({
    queryKey: storeQueryKey(organizationId),
    queryFn: getStore,
    enabled: Boolean(organizationId) && canView,
    staleTime: fresh ? 0 : Infinity,
    refetchOnMount: fresh ? "always" : false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2
  });
  const isAvailable = canView && query.isSuccess;
  // Hidden for good: no permission, or the backend doesn't have stores.
  const isHidden =
    (!isMembershipLoading && !canView) ||
    (query.isError && isNotFoundError(query.error));
  return { ...query, canView, isAvailable, isHidden };
}

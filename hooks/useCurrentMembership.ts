import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { getCurrentMembership } from "@/client-api/functions/organizations";
import { hasMembershipPermission } from "@/lib/permissions";
import { useOrganizationStore } from "@/stores/organizationStore";

export const membershipQueryKey = (orgId?: string) => ["membership", orgId];

/**
 * No answer (a network blip, a timeout) or a failure on the server's side.
 * That says nothing about the member's access, so it's worth asking again;
 * a 401, 403 or 404 is a real answer.
 */
export const isTemporaryMembershipFailure = (error: unknown) => {
  const status = (error as AxiosError | null)?.response?.status;
  return !status || status >= 500 || status === 408 || status === 429;
};

const MAX_RETRIES = 3;
export const MEMBERSHIP_RETRY_MS = 15_000;

export function useCurrentMembership() {
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);

  const { data, isPending, isError, error } = useQuery({
    queryKey: membershipQueryKey(orgId),
    queryFn: getCurrentMembership,
    enabled: Boolean(orgId),
    staleTime: 60_000,
    // A brief network problem must not read as "no access" (that would
    // send people away from gated pages and hide menu items): retry a few
    // times, then keep asking every 15 s until the server answers.
    retry: (failureCount, failure) =>
      failureCount < MAX_RETRIES && isTemporaryMembershipFailure(failure),
    refetchInterval: (query) =>
      query.state.status === "error" &&
      query.state.data === undefined &&
      isTemporaryMembershipFailure(query.state.error)
        ? MEMBERSHIP_RETRY_MS
        : false
  });

  const role = data?.role ?? undefined;
  const grants = data?.effectivePermissionGrants;

  const can = useCallback(
    (permission: string) => hasMembershipPermission(role, grants, permission),
    [role, grants]
  );

  return {
    role,
    isOwner: role === "owner",
    isAdmin: role === "admin",
    isOwnerOrAdmin: role === "owner" || role === "admin",
    // Pending (not just fetching) so gated UI renders nothing until the
    // answer is known, instead of flashing controls and then removing them.
    // A temporary failure with no answer yet is still "not known", so pages
    // wait for the retry instead of treating the member as having no access.
    isLoading:
      isPending ||
      (isError && data === undefined && isTemporaryMembershipFailure(error)),
    can,
    permissionSchema: data?.permissionSchema
  };
}

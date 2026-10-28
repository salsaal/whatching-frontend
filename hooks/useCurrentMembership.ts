import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCurrentMembership } from "@/client-api/functions/organizations";
import { hasMembershipPermission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/authStore";
import { useOrganizationStore } from "@/stores/organizationStore";

export const membershipQueryKey = (orgId?: string) => ["membership", orgId];

export function useCurrentMembership() {
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const userId = useAuthStore((state) => state.user?._id);

  const { data, isPending } = useQuery({
    queryKey: membershipQueryKey(orgId),
    queryFn: () => getCurrentMembership(userId),
    enabled: Boolean(orgId),
    staleTime: 60_000
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
    isLoading: isPending,
    can,
    permissionSchema: data?.permissionSchema
  };
}

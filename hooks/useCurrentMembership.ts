import { useQuery } from "@tanstack/react-query";

import { getTeam } from "@/client-api/functions/organizations";
import { useAuthStore } from "@/stores/authStore";
import { useOrganizationStore } from "@/stores/organizationStore";

export function useCurrentMembership() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const user = useAuthStore((state) => state.user);

  const { data, isLoading } = useQuery({
    queryKey: ["team", activeOrganization?._id],
    queryFn: getTeam,
    enabled: Boolean(activeOrganization?._id)
  });

  const membership = data?.data.team.find(
    (member) => member.userId._id === user?._id
  );
  const role = membership?.role;

  return {
    role,
    isOwner: role === "owner",
    isAdmin: role === "admin",
    isOwnerOrAdmin: role === "owner" || role === "admin",
    isLoading
  };
}
